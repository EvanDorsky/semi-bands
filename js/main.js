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

// physical constants
var e0 = 8.8542e-12; // F/m
var kS = 11.9;
var q = 1.602e-19; // J
var T = 300; // K
var k = 1.381e-23; // J/K
var ni = 1e10; // 1/cm^3 | p*n=ni^2

function pn(NA, ND, VA, L) {
  var dep = depletion(NA, ND, VA);

  var rho = _.range(-L/2, 0, L/2*dep.xp)
    .concat(_.range(0, L/2, L/2*dep.xn))
    .map(function charge(x) {
      if (-dep.xp < x && x < 0)
        return { x: x,y: -q*NA };

      if (0 < x && x < dep.xn)
        return { x: x, y: q*ND };

      return { x: x, y: 0 };
    }).memoize();

  var efield = integrate(rho)
    .map(function(n) {
      return { x: n.x, y: q*n.y/(kS*e0) }
    });

  var E = integrate(efield).map(function(d) {return {x:d.x, y:-d.y}});

  return {
    rho: rho,
    efield: efield,
    E: E,
  }
}

function depletion(NA, ND, VA) {
  var V0 = k*T/q*Math.log((NA*ND)/(ni*ni)); // V
  var W = Math.sqrt(2*kS*e0/q*(1/NA + 1/ND)*(V0 - VA)); // cm?
  var xp = W*ND/(NA + ND);
  var xn = W*NA/(NA + ND);
  return {
    V0: V0,
    xp: xp,
    xn: xn
  }
}

function plotpn(pn, svg) {
  plot(svg, 'charge', pn.rho, 1, 3, 0);
  plot(svg, 'field', pn.efield, 1, 3, 1);
  plot(svg, 'energy', pn.E, 1, 3, 2);
}

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
  var NA = 5e14; // 1/cm^3
  var ND = 1e14; // 1/cm^3
  var VA = 0;
  var L = 0.02;

  var svg = makeplot(600, 600);
  plotpn(pn(NA, ND, VA, L), svg);
  $('.line').mousemove(function(e) {
    var VA = -e.pageY/100;
    plotpn(pn(NA, ND, VA, L), svg);
  })
}