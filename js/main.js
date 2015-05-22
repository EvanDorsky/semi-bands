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
  d3.select('body')
  .append('svg').attr('width', 600).attr('height', 600)
  .append('g')
  .selectAll('circle')
  .data(E.toArray())
  .enter().append('circle')
  .attr('cx', function(d, i) {return i*3+1})
  .attr('cy', function(d) {return l*l*d+599})
  .attr('r', 1)
}