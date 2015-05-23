_ = Lazy;

// integrate f from a to b with n steps
function integrate(f) {
  var l = f.size();
  var acc = 0;
  return _.generate(function(i) {
      acc += f.get(i)/l;
      return acc;
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

var l = 500;
var rho = _.generate(function charge(x) {
  // convert from step [0 - 499] to position in cm [-.01 - .01]
  var pos =  x/(l-1)*L - L/2;

  if (-xp < pos && pos < 0)
    return -q*NA;

  if (0 < pos && pos < xn)
    return q*ND;

  return 0;
}, l);

var efield = integrate(rho)
  .map(function(n) {return q*n/(kS*e0)});

var E = integrate(efield);

function makeplot(w, h) {
  return d3.select('body')
  .append('svg').attr('width', w).attr('height', h);
}

function plot(svg, label, data, numx, numy, ypos) {
  var x = d3.scale.linear()
    .domain([0, data.length])
    .range([0, svg.attr('width')/numx]);

  var h = svg.attr('height')/numy;
  var y = d3.scale.linear()
    .domain(d3.extent(data))
    .range([ypos*h, (ypos+1)*h]);

  var eline = d3.svg.line()
    .x(function(d, i) { return x(i) })
    .y(function(d) { return y(d) })

  svg.append('g')
  .append('path')
  .attr('class', 'line '+label)
  .attr('d', eline(data))
}

window.onload = function() {
  var svg = makeplot(600, 600);
  plot(svg, 'charge', rho.toArray(), 1, 3, 0);
  plot(svg, 'field', efield.toArray(), 1, 3, 1);
  plot(svg, 'energy', E.toArray(), 1, 3, 2);
}