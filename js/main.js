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

// representation of a polynomial function
// coefs = [a0, a1, a2, a3, ...]
function Poly(_coefs) {
  var poly = {
    coefs: _coefs,
    diff: function() {
      var dcoefs = poly.coefs;
      for (var i in dcoefs)
        dcoefs[i] *= Number(i)+1;

      dcoefs.shift()
      poly.coefs = dcoefs;

      return poly;
    },
    int: function() {
      var icoefs = poly.coefs;
      for (var i in icoefs)
        icoefs[i] /= Number(i)+2;

      icoefs.unshift(0);
      poly.coefs = icoefs;

      return poly;
    },
    sample: function(range, dx) {
      var a = range[0];
      var b = range[range.length-1];
      if (arguments.length === 2) {
        var X = _.range(a, b, dx);

        var Y = X.map(function(x) {
          return _(poly.coefs).map(function(coef, i) {
            return coef*Math.pow(x, i+1);
          }).memoize().reduce(function(x,y){
            return x+y
          });
        });

        return X.zip(Y.toArray()).map(function(x) {
          return {
            x: x[0],
            y: x[1]
          }
        }).toArray()
      }
    }
  }

  return poly;
}

function PolyFunc(_polys) {
  var func = {
    polys: _polys,
    int: function() {
      return func.polys.map(function(spec) {
        return spec.poly.int()
      })
    },
    diff: function() {
      return func.polys.map(function(spec) {
        return spec.poly.diff()
      })
    },
    sample: function(dx) {
      return func.polys.map(function(spec) {
        return spec.poly.sample(spec.range, dx)
      }).reduce(function(x, y) { return x.concat(y) })
    }
  }

  return func;
}

// physical constants
var e0 = 8.8542e-12; // F/m
var kS = 11.9;
var q = 1.602e-19; // J
var T = 300; // K
var k = 1.381e-23; // J/K
var ni = 1e10; // 1/cm^3 | p*n=ni^2

function pnJunction(props) {
  var depletion = function dep(NA, ND, VA) {
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

  var junc = {
    update: function pn() {
      var NA = p.NA;
      var ND = p.ND;
      var VA = p.VA;
      var L = p.L;

      var dep = depletion(NA, ND, VA);
      junc.Vbi = dep.V0;

      junc.rho = PolyFunc([
        {
          poly: Poly([0]),
          range: [-L/2, -dep.xp]
        },
        {
          poly: Poly([-q*NA]),
          range: [-dep.xp, 0]
        },
        {
          poly: Poly([q*ND]),
          range: [0, dep.xn]
        },
        {
          poly: Poly([0]),
          range: [dep.xn, L/2]
        }
      ]);

      console.log('junc.rho');
      console.log(junc.rho);
      console.log('junc.rho.int()');
      console.log(junc.rho.int());
      console.log('junc.rho.sample(.0001)');
      console.log(junc.rho.sample(.0001));

      junc.efield = integrate(junc.rho)
        .map(function(n) {
          return { x: n.x, y: q*n.y/(kS*e0), dx:n.dx }
        });

      junc.E = integrate(junc.efield).map(function(d) {return {x:d.x, y:-d.y/q}});
    }
  }

  // defaults
  var p = {
    NA: 5e14,
    ND: 1e14,
    VA: 0,
    L: 0.02
  }

  if (arguments.length)
    Object.keys(props).forEach(function(key) {
      p[key] = props[key];
    });

  // generate getters/setters
  Object.keys(p).forEach(function(key) {
    junc[key] = function(_) {
      if (!arguments.length) return p[key];
      p[key] = _;
      junc.update();
      return junc;
    };
  })

  junc.update();
  return junc;
}

window.onload = function() {
  var junction = new pnJunction({
    NA: 1e14,
    ND: 4e14,
    VA: 0,
    L: .02
  });

  var PNC = pnChart(junction);

  d3.select('button.NA')
    .on('click', function() {
      var NAnew = Number(d3.select('input.NA')
        .property('value'));
      PNC.update({
        NA: NAnew
      });
    })

  d3.select('button.ND')
    .on('click', function() {
      var NDnew = Number(d3.select('input.ND')
        .property('value'));
      PNC.update({
        ND: NDnew
      });
    })
}

function pnChart(junc) {
  if (!arguments.length)
    console.error('Requires a pn junction!');
  var chart = {
    junc: junc,
    rhoC: semiChart(),
    efieldC: semiChart(),
    EC: semiChart(),
    update: function updatepnChart(opts) {
      Object.keys(opts).forEach(function(key) {
        chart.junc[key](opts[key])
      });

      d3.select('#rho')
      .datum(chart.junc.rho)
      .call(chart.rhoC.update)
      
      d3.select('#efield')
      .datum(chart.junc.efield)
      .call(chart.efieldC.update)
      
      d3.select('#E')
      .datum(chart.junc.E)
      .call(chart.EC.update)
    }
  };

  chart.rhoC.line().interpolate('step')
  d3.select('body')
    .append('div')
    .attr('id', 'rho')
    .datum(chart.junc.rho)
    .call(chart.rhoC)
    .call(chart.rhoC.update);

  d3.select('body')
    .append('div')
    .attr('id', 'efield')
    .datum(chart.junc.efield)
    .call(chart.efieldC)
    .call(chart.efieldC.update);

  d3.select('body')
    .append('div')
    .attr('id', 'E')
    .datum(chart.junc.E)
    .call(chart.EC)
    .call(chart.EC.update)
    .on('mousemove', function() {
      var V = chart.EC.yScale().invert(d3.mouse(this)[1]-chart.EC.margin().bottom)
      if (V<.05)
        return

      chart.update({
        VA: chart.junc.Vbi-V
      });
    });

  return chart
}

function semiChart() {
  var margin = {top: 20, right: 20, bottom: 20, left: 20},
    width = 760,
    height = 120,
    xScale = d3.scale.linear(),
    yScale = d3.scale.linear(),
    line = d3.svg.line().x(X).y(Y);

  function chart(selection) {
    selection.each(function(data) {
      xScale
        .domain(d3.extent(data.pluck('x').toArray()))
        .range([0, width - margin.left - margin.right]);

      yScale
        .domain(d3.extent(data.pluck('y').toArray()))
        .range([height - margin.top - margin.bottom, 0]);

      // Select the svg element, if it exists.
      var svg = d3.select(this).selectAll('svg').data([data.toArray()]);

      // Otherwise, create the skeletal chart.
      var gEnter = svg.enter().append('svg').append('g');
      // gEnter.append('path').attr('class', 'line');
      svg.select('g').selectAll('circle')
      .data(data.toArray())
      .enter().append('circle')
      .attr('cx', function(d) {return X(d)})
      .attr('cy', function(d) {return Y(d)})
      .attr('r', 2)

      svg.attr('width', width)
         .attr('height', height);

      var g = svg.select('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    });
  }

  chart.update = function(selection) {
    selection.each(function(data) {

      // var svg = d3.select(this).selectAll('svg').data([data.toArray()]);
      var svg = d3.select(this).selectAll('svg');
      // svg.select('g').select('.line')
      //   .attr('d', line)
      // });
      var upd = svg.select('g').selectAll('circle')
      .data(data.toArray())

      upd.enter().append('circle')

      upd.attr('cx', function(d) {return X(d)})
      .attr('cy', function(d) {return Y(d)})
      .attr('r', 2)

      upd.exit().remove()

      return chart;
    })
  }

  function X(d) {
    return xScale(d.x);
  }

  function Y(d) {
    return yScale(d.y);
  }

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.line = function(_) {
    if (!arguments.length) return line;
    line = _;
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return yScale;
    yScale = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) return xScale;
    xScale = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  };

  return chart;
} // after http://bost.ocks.org/mike/chart/