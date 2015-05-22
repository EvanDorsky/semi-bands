_ = Lazy;

// integrate f from a to b with n steps
function integrate(f) {
  var l = f.size();
  var acc = 0;
  return _.generate(function(i) {
      acc += f.get(i)/l;
      return acc;
    }, l);
}

var l = 100;
var Q = _.generate(function charge(x) {
  var pos =  2*x/(l-1) - 1;
  var apos = Math.abs(pos);
  if (apos < .2)
    return pos == 0? 0 : -apos/pos; // sign of x

  return 0;
}, l);

var efield = integrate(Q);

var E = integrate(efield);

function makeplot(w, h) {
  return d3.select('body')
  .append('svg').attr('width', w).attr('height', h);
}

function plot(svg, data, subx, suby, yoff) {
  var x = d3.scale.linear()
    .domain([0, data.length])
    .range([0, subx]);

  var y = d3.scale.linear()
    .domain(d3.extent(data))
    .range([yoff, yoff+suby]);

  var eline = d3.svg.line()
    .x(function(d, i) { return x(i) })
    .y(function(d) { return y(d) })

  svg.append('g')
  .append('path')
  .attr('class', 'line')
  .attr('d', eline(data))
}

window.onload = function() {
  var svg = makeplot(600, 600);
  plot(svg, Q.toArray(), 600, 200, 0);
  plot(svg, efield.toArray(), 600, 200, 200);
  plot(svg, E.toArray(), 600, 200, 400);
}