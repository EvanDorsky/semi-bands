_ = Lazy

// representation of a polynomial function
// coefs = [a0, a1, a2, a3, ...]
function Poly(_coefs) {
  var poly = {
    coefs: _coefs,
    diff: function() {
      var dcoefs = poly.coefs
      dcoefs.forEach(function(coef, n) {
        dcoefs[n] *= n
      })

      dcoefs.shift()
      poly.coefs = dcoefs

      return poly
    },
    int: function(C) {
      var icoefs = poly.coefs
      icoefs.forEach(function(coef, n) {
        icoefs[n] /= n+1
      })

      icoefs.unshift(C)
      poly.coefs = icoefs

      return poly
    },
    sampled: function(range, dx) {
      var a = range[0]
      var b = range[range.length-1]
      if (arguments.length === 2) {
        var X = _.range(a, b, dx)

        var Y = X.map(function(x) {
          return poly.coefs.map(function(coef, i) {
            return coef*Math.pow(x, i)
          }).reduce(function(x,y){
            return x+y
          })
        })

        return X.zip(Y.toArray()).map(function(x) {
          return {
            x: x[0],
            y: x[1]
          }
        })
      }
    },
    mult: function(a) {
      poly.coefs = poly.coefs.map(function(coef) {
        return coef*a
      })

      return poly
    },
    sampledAt: function(x) {
      return _(poly.coefs).map(function(coef, i) {
        return coef*Math.pow(x, i)
      }).memoize().reduce(function(x,y){
        return x+y
      })
    }
  }

  return poly
}

function PolyFunc(_polys) {
  var func = {
    polys: _polys,
    int: function() {
      var temp = [{
        poly: func.polys[0].poly.int(0),
        range: func.polys[0].range
      }]
      for (var i = 1; i < func.polys.length; i++) {
        var pol = func.polys[i].poly
        var r = func.polys[i].range
        var ptemp = temp[i-1].poly

        var pre = pol.int(0).sampledAt(r[0])
        var C = ptemp.sampledAt(r[0]) - pre
        var pint = pol.diff().int(C)

        temp.push({
          poly: pint,
          range: r
        })
      }

      func.polys = temp

      return func
    },
    diff: function() {
      func.polys = func.polys.map(function(spec) {
        return {
          poly: spec.poly.diff(),
          range: spec.range
        }
      })
      
      return func
    },
    mult: function(a) {
      func.polys = func.polys.map(function(spec) {
        return {
          poly: spec.poly.mult(a),
          range: spec.range
        }
      })
      
      return func
    },
    sampled: function(dx) {
      return func.polys.map(function(spec) {
        return spec.poly.sampled(spec.range, dx)
      }).reduce(function(x, y) { return x.concat(y) })
    }
  }

  return func
}

// physical constants
var e0 = 8.8542e-12 // F/m
var kS = 11.9
var q = 1.602e-19 // J
var T = 300 // K
var k = 1.381e-23 // J/K
var ni = 1e10 // 1/cm^3 | p*n=ni^2

function pnJunction(props) {
  var depletion = function dep(NA, ND, VA) {
    var V0 = k*T/q*Math.log((NA*ND)/(ni*ni)) // V
    var W = Math.sqrt(2*kS*e0/q*(1/NA + 1/ND)*(V0 - VA)) // cm?
    var xp = W*ND/(NA + ND)
    var xn = W*NA/(NA + ND)
    return {
      V0: V0,
      xp: xp,
      xn: xn
    }
  }

  var junc = {
    update: function pn() {
      var NA = p.NA
      var ND = p.ND
      var VA = p.VA
      var L = p.L

      var dep = depletion(NA, ND, VA)
      junc.Vbi = dep.V0

      var rho = new PolyFunc([
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
      ])

      junc.rho = _(rho.sampled(p.dx))
      junc.efield = _(rho.int(0).mult(q/(kS*e0)).sampled(p.dx))
      junc.E = _(rho.int(0).mult(-1/q).sampled(p.dx))
    }
  }

  // defaults
  var p = {
    NA: 5e14,
    ND: 1e14,
    VA: 0,
    L: 0.02,
    dx: .0001
  }

  if (arguments.length)
    Object.keys(props).forEach(function(key) {
      p[key] = props[key]
    })

  // generate getters/setters
  Object.keys(p).forEach(function(key) {
    junc[key] = function(_) {
      if (!arguments.length) return p[key]
      p[key] = _
      junc.update()
      return junc
    }
  })

  junc.update()
  return junc
}

window.onload = function() {
  var junction = new pnJunction({
    NA: 1e14,
    ND: 4e14,
    VA: 0,
    L: .02
  })

  var PNC = pnChart(junction)

  _(['NA', 'ND']).each(function (param) {
    d3.select('button.'+param)
      .on('click', function() {
        var upd = {}
        upd[param] = Number(d3.select('input.'+param).property('value'))
        PNC.update(upd)
      })
  })

}

function pnChart(junc) {
  if (!arguments.length)
    console.error('Requires a pn junction!')
  var chart = {
    junc: junc,
    rhoC: semiChart(),
    efieldC: semiChart(),
    EC: semiChart(),
    names: ['rho', 'efield', 'E'],
    update: function updatepnChart(opts) {
      Object.keys(opts).forEach(function(key) {
        chart.junc[key](opts[key])
      })

      chart.names.forEach(function(name) {
        d3.select('#'+name)
        .datum(chart.junc[name])
        .call(chart[name+'C'].update)
      })
    }
  }

  chart.rhoC.line().interpolate('step-after')

  chart.names.forEach(function(name) {
    d3.select('body')
      .append('div')
      .attr('id', name)
      .datum(chart.junc[name])
      .call(chart[name+'C'])
      .call(chart[name+'C'].update)
  })

  d3.select('#E')
    .on('mousemove', function() {
      var V = chart.EC.yScale().invert(d3.mouse(this)[1]-chart.EC.margin().bottom)
      if (V<.05)
        return

      chart.update({
        VA: chart.junc.Vbi-V
      })
    })

  return chart
}

function semiChart() {
  var p = {
    margin: {top: 20, right: 20, bottom: 20, left: 20},
    width: 760,
    height: 120,
    xScale: d3.scale.linear(),
    yScale: d3.scale.linear(),
    line: d3.svg.line().x(X).y(Y)
  }

  function chart(selection) {
    selection.each(function(data) {
      p.xScale
        .domain(d3.extent(data.pluck('x').toArray()))
        .range([0, p.width - p.margin.left - p.margin.right])

      p.yScale
        .domain(d3.extent(data.pluck('y').toArray()))
        .range([p.height - p.margin.top - p.margin.bottom, 0])

      var svg = d3.select(this).selectAll('svg').data([data.toArray()])

      svg.enter().append('svg').append('g')
        .append('path').attr('class', 'line')

      svg.attr('width', p.width)
        .attr('height', p.height)

      svg.select('g')
        .attr('transform', 'translate(' + p.margin.left + ',' + p.margin.top + ')')
    })
  }

  chart.update = function(selection) {
    selection.each(function(data) {
      var svg = d3.select(this).selectAll('svg').data([data.toArray()])
      svg.select('g').select('.line')
        .attr('d', p.line)

      return chart
    })
  }

  function X(d) {
    return p.xScale(d.x)
  }

  function Y(d) {
    return p.yScale(d.y)
  }

  // generate getters/setters
  Object.keys(p).forEach(function(key) {
    chart[key] = function(_) {
      if (!arguments.length) return p[key]
      p[key] = _
      return chart
    }
  })

  return chart
} // after http://bost.ocks.org/mike/chart/