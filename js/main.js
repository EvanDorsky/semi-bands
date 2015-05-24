_ = Lazy;

// integrate f from a to b with n steps
function integrate(f) {
  var l = f.size();
  var acc = 0;
  return _.generate(function(i) {
      var dx = 0;
      if (i == 0)
        dx = f.get(i+1).x-f.get(i).x;
      else
        dx = f.get(i).x-f.get(i-1).x;
      acc += f.get(i).y*dx;
      return {
        x: f.get(i).x,
        y: acc
      };
    }, l).memoize();
}

// semiconductor properties
var NA = 5e14; // 1/cm^3
var ND = 1e14; // 1/cm^3
var e0 = 8.8542e-12; // F/m
var kS = 11.9;
var q = 1.602e-19; // J
var T = 300; // K
var k = 1.381e-23; // J/K
var ni = 1e10; // 1/cm^3 | p*n=ni^2
var V0 = k*T/q*Math.log((NA*ND)/(ni*ni)); // V
var VA = 0; // V
var W = Math.sqrt(2*kS*e0/q*(1/NA + 1/ND)*(V0 - VA)); // cm?
var xp = W*ND/(NA + ND);
var xn = W*NA/(NA + ND);

var L = .02;

var rho = _.range(-L/2, 0, L/2*xp)
  .concat(_.range(0, L/2, L/2*xn))
  .map(function charge(x) {
    if (-xp < x && x < 0)
      return {
        x: x,
        y: -q*NA
      };

    if (0 < x && x < xn)
      return {
        x: x,
        y: q*ND
      };

    return {
      x: x,
      y: 0
    };
  }).memoize();

var efield = integrate(rho)
  .map(function(n) {
    return {
      x: n.x,
      y: q*n.y/(kS*e0)
    }
  });

var E = integrate(efield).map(function(d) {return {x:d.x, y:-d.y}});

function makeplot(w, h) {
  return d3.select('body')
  .append('svg').attr('width', w).attr('height', h);
}

function plot(svg, label, data, numx, numy, ypos) {
  var x = d3.scale.linear()
    .domain(d3.extent(data.pluck('x').toArray()))
    .range([0, svg.attr('width')/numx]);

  var h = svg.attr('height')/numy;
  var y = d3.scale.linear()
    .domain(d3.extent(data.pluck('y').toArray()))
    .range([(ypos+1)*h, ypos*h]);

  var eline = d3.svg.line()
    .x(function(d) { return x(d.x) })
    .y(function(d) { return y(d.y) })

  svg.append('g')
  .append('path')
  .attr('class', 'line '+label)
  .attr('d', eline(data.toArray()))
}

window.onload = function() {
  var svg = makeplot(600, 600);
  plot(svg, 'charge', rho, 1, 3, 0);
  plot(svg, 'field', efield, 1, 3, 1);
  plot(svg, 'energy', E, 1, 3, 2);
}