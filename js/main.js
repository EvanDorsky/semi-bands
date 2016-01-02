_ = Lazy

// representation of a polynomial function
// coefs = [a0, a1, a2, a3, ...]
function Poly(_coefs) {
  var poly = {
    coefs: _coefs,
    dxmin: 1e-8,
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

      if (arguments.length === 1) {
        if (typeof(range) === 'object') // use optimal `dx`
          dx = (b-a)/10
        else
          console.error('Error: Range required by PolyFunc.sampled()')
      }

      var X = _.range(a, b+dx, dx)

      var Y = X.map(function(x) {
        return _(poly.coefs).map(function(coef, i) {
          return coef*Math.pow(x, i)
        }).sum()
      })

      return X.zip(Y.toArray()).map(function(x) {
        return {
          x: x[0],
          y: x[1]
        }
      })
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
      }).sum()
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
        return spec.poly.sampled(spec.range)
      }).reduce(function(x, y) { return x.concat(y) })
    }
  }

  return func
}

// physical constants
var e0 = 8.8542e-14 // F/cm
var kS = 11.9
var q = 1.602e-19 // J
var T = 300 // K
var k = 1.381e-23 // J/K
var ni = 1e10 // 1/cm^3 | p*n=ni^2

function pnJunction(props) {
  var depletion = function dep(NA, ND, VA) {
    var V0 = k*T/q*Math.log((NA*ND)/(ni*ni)) // V
    var W = Math.sqrt(2*kS*e0/q*(1/NA + 1/ND)*(V0 - VA)) // cm
    var xp = W*ND/(NA + ND) // cm
    var xn = W*NA/(NA + ND) // cm

    // http://www.ioffe.rssi.ru/SVA/NSM/Semicond/Si/electric.html
    var A = 1e-2 // cm^2
    var taup = 1e-4 // sec
    var taun = 1e-4 // sec
    var Dp = 12 // cm^2/sec
    var Dn = 36 // cm^2/sec

    var Is = q*A*(Math.sqrt(Dp/taup)*ni*ni/ND + Math.sqrt(Dn/taun)*ni*ni/NA) // A

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

      var block = [
        {
          poly: Poly([0]),
          range: [-L/2, -dep.xp],
          type: 'p'
        },
        {
          poly: Poly([-q*NA]),
          range: [-dep.xp, 0],
          type: 'pdep'
        },
        {
          poly: Poly([q*ND]),
          range: [0, dep.xn],
          type: 'ndep'
        },
        {
          poly: Poly([0]),
          range: [dep.xn, L/2],
          type: 'n'
        }
      ]
      var rho = new PolyFunc(block)

      junc.block = block
      junc.rho = _(rho.sampled(p.dx))
      junc.efield = _(rho.int(0).mult(q/(kS*e0)).sampled(p.dx))
      junc.V = _(rho.int(0).mult(-1/q).sampled(p.dx))
      // junc.I = 
    }
  }

  // defaults
  var p = {
    NA: 5e14,
    ND: 1e14,
    VA: 0,
    L: .002,
    dx: .00001
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
    L: .002
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
    block: semiBlockChart(),
    overlay: overlayChart(),
    subs: {
      rho: {
        title: 'Charge Density',
        plot: semiChart()
      },
      efield: {
        title: 'Electric Field',
        plot: semiChart()
      },
      V: {
        title: 'Voltage',
        plot: semiChart()
      }
    },
    update: function updatepnChart(opts) {
      Object.keys(opts).forEach(function(key) {
        chart.junc[key](opts[key])
      })

      d3.select('#block')
        .datum(chart.junc.block)
        .call(chart.block.update)

      d3.select('#overlay')
        .datum(chart.junc.block)
        .call(chart.overlay.update)

      for (var name in chart.subs) {
        var sub = chart.subs[name]

        d3.select('#'+name)
          .datum(chart.junc[name])
          .call(sub.plot.update)
      }
      return chart.junc
    }
  }

  d3.select('#container')
    .append('div')
    .attr('id', 'block')
    .datum(chart.junc.block)
    .call(chart.block)
    .call(chart.block.update)

  chart.subs.rho.plot.line().interpolate('step-after')

  for (var name in chart.subs) {
    var sub = chart.subs[name]

    d3.select('#container')
      .append('div')
      .attr('id', name)
      .datum(chart.junc[name])
      .call(sub.plot)
      .call(sub.plot.update)
      .select('svg')
      .append('text')
      .text(sub.title)
      .attr('x', 760/2)
      .attr('y', 12)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'sans-serif')
  }

  d3.select('#container')
    .append('div')
    .attr('id', 'overlay')
    .datum(chart.junc.block)
    .call(chart.overlay)
    .call(chart.overlay.update)

  d3.select('#V')
    .on('mousemove', function() {
      var V = chart.subs.V.plot.yScale().invert(d3.mouse(this)[1]-chart.subs.V.plot.margin().bottom)
      if (V<.05)
        return

      var VA = chart.junc.Vbi-V;

      d3.select('#bias')
        .text(VA.toPrecision(3)+' V')

      chart.update({
        VA: VA
      })
    })
    .selectAll('svg')
    .append('text')
    .attr('id', 'bias')

  return chart
}

function semiChart() {
  var p = {
    margin: {top: 20, right: 20, bottom: 20, left: 20},
    width: 760,
    height: 140,
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

      var svg = d3.select(this).append('svg')
        .attr('width', p.width)
        .attr('height', p.height)

      svg.append('g').data([data.toArray()])
        .append('path').attr('class', 'line')

      svg.select('g')
        .attr('transform', 'translate(' + p.margin.left + ',' + p.margin.top + ')')
    })
  }

  chart.update = function(selection) {
    selection.each(function(data) {
      var svg = d3.select(this).select('svg').datum(data.toArray())
      svg.select('.line')
        .attr('d', p.line)
    })
    return chart
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

function semiBlockChart() {
  var p = {
    margin: {top: 20, right: 20, bottom: 20, left: 20},
    width: 760,
    height: 140,
    xScale: d3.scale.linear(),
    yScale: d3.scale.linear()
  }

  function chart(selection) {
    selection.each(function(data) {
      var rects = _(data).pluck('range').toArray()

      var xDomain = d3.extent(_(rects).reduce(function(x, y)
        { return x.concat(y) }))

      p.blockWidth = xDomain[1] - xDomain[0]
      p.plotWidth = p.width - p.margin.left - p.margin.right
      p.plotHeight = p.height - p.margin.top - p.margin.bottom

      p.xScale
        .domain(xDomain)
        .range([0, p.plotWidth])

      var svg = d3.select(this).append('svg')
        .attr('width', p.width)
        .attr('height', p.height)

      svg.append('g')
        .attr('transform', 'translate(' + p.margin.left + ',' + p.margin.top + ')')

      svg.select('g').selectAll('rect')
        .data(rects).enter().append('rect')
        .attr('class', function(d, i) {
          return data[i].type
        })
    })
  }

  chart.update = function(selection) {
    selection.each(function(data) {
      var rects = _(data).pluck('range').toArray()

      d3.select(this).selectAll('rect')
        .data(rects)
        .attr('width', function(d) {
          return (d[1] - d[0])/p.blockWidth * p.plotWidth
        })
        .attr('height', p.plotHeight)
        .attr('x', function(d) {
          return p.xScale(d[0])
        })
    })
    return chart
  }

  return chart
}

function overlayChart() {
  var p = {
    margin: {top: 20, right: 20, bottom: 20, left: 20},
    width: 760,
    height: 140*4+20,
    xScale: d3.scale.linear()
  }

  function chart(selection) {
    selection.each(function(data) {
      var rects = _(data).pluck('range').toArray()

      var xDomain = d3.extent(_(rects).reduce(function(x, y)
        { return x.concat(y) }))

      p.blockWidth = xDomain[1] - xDomain[0]
      p.plotWidth = p.width - p.margin.left - p.margin.right
      p.plotHeight = p.height - p.margin.top - p.margin.bottom

      var lines = _(rects).rest().map(function(x) {
        return [{ x: x[0], y: 0 }, { x: x[0], y: p.plotHeight }]
      }).toArray()

      p.xScale
        .domain(xDomain)
        .range([0, p.plotWidth])

      var svg = d3.select(this).append('svg')
        .attr('width', p.width)
        .attr('height', p.height)

      svg.append('g')
        .attr('transform', 'translate(' + p.margin.left + ',' + p.margin.top + ')')

      svg.select('g').selectAll('path')
        .data(lines).enter()
        .append('path').attr('class', 'line')
    })
  }

  chart.update = function(selection) {
    selection.each(function(data) {
      var lines = _(data).pluck('range').map(function(x) {
        return [{ x: x[0], y: 0 }, { x: x[0], y: p.plotHeight }]
      }).rest().toArray()

      d3.select(this).selectAll('path').data(lines)
        .attr('d', d3.svg.line()
          .x(function(d) {
            return p.xScale(d.x)
          })
          .y(function(d) {
            return d.y
          }).interpolate('linear'))
    })
    return chart
  }

  return chart
}