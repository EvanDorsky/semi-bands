_ = Lazy;

// integrate f from a to b with n steps
function integrate(f, n) {
  var acc = 0;
  return _.range(0, n)
    .map(function(i) {
      acc += f.get(i);
      return acc;
    }).memoize();
}

function atof() {
  return 1;
}

var l = 100;
var poses = [];
var charge = _.generate(function charge(x) {
  var pos =  x/(l-1) - .5;
  var apos = Math.abs(pos);
  if (apos < .2)
    return pos == 0? 0 : apos/pos; // sign of x

  return 0;
}, l);

var efield = integrate(charge, l);

var E = integrate(efield, l);

$(document).ready(function() {
  d3.select('body')
  .append('svg').attr('width', 600).attr('height', 600)
  .append('g')
  .selectAll('circle')
  .data(E.toArray())
  .enter().append('circle')
  .attr('cx', function(d, i) {return i*3})
  .attr('cy', function(d) {return d+600})
  .attr('r', 1)
})
