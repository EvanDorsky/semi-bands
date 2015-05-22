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
    return pos == 0? 0 : apos/pos; // sign of x

  return 0;
}, l);

var efield = integrate(Q);

var E = integrate(efield);

window.onload = function() {
  var Energy = E.toArray();

  var w = 600;
  var h = 600;

  var x = d3.scale.linear()
    .domain([0, Energy.length])
    .range([0, w]);

  var y = d3.scale.linear()
    .domain(d3.extent(Energy))
    .range([0, h]);

  var eline = d3.svg.line()
    .x(function(d, i) { return x(i) })
    .y(function(d) { return y(d) })

  d3.select('body')
  .append('svg').attr('width', w).attr('height', h)
  .append('g')
  .append('path')
  .attr('class', 'line')
  .attr('d', eline(Energy))
}