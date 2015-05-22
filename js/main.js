(function() {
  _ = Lazy;

  // integrate f from a to be with n even
  function integrate(f, a, b, n) {
    var h = (b - a)/n;
    var s = f(a) + f(b);

    // odd numbers
    s += _.range(1, n, 2)
      .map(function(i) { return 4*f(a + i*h) })
      .reduce(function(x, y) { return x + y });

    // even numbers
    s += _.range(2, n-1, 2)
      .map(function(i) { return 2*f(a + i*h) })
      .reduce(function(x, y) { return x + y });

    return s * h/3;
  }

  var cumulative = 0;
  var time = _.range(100)
  .map(function(i, x) {
    cumulative += x;
    return cumulative  
  })
  .toArray();

  console.log('time');
  console.log(time);
})()