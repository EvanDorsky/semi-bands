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
          return _(poly.coefs).map(function(coef, i) {
            return coef*Math.pow(x, i)
          }).memoize().reduce(function(x,y){
            return x+y
          })
        })

        return X.zip(Y.toArray()).map(function(x) {
          return {
            x: x[0],
            y: x[1]
          }
        }).toArray()
      }
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
    copy: function() {
      return new PolyFunc(func.polys)
    },
    sampled: function(dx) {
      return func.polys.map(function(spec) {
        return spec.poly.sampled(spec.range, dx)
      }).reduce(function(x, y) { return x.concat(y) })
    }
  }

  return func
}

window.onload = function() {
  var PFtest = new PolyFunc([
    {
      poly: Poly([0]),
      range: [-2, -1]
    },
    {
      poly: Poly([-1]),
      range: [-1, 0]
    },
    {
      poly: Poly([1]),
      range: [0, 1]
    },
    {
      poly: Poly([0]),
      range: [1, 2]
    }
  ])

  var Psampled = _(PFtest.sampled(.1))
  console.log('Psampled');
  console.log(Psampled.pluck('y').toArray());

  var chart = semiChart()
  d3.select('body')
    .append('div')
    .datum(Psampled)
    .call(chart)

  var Pintsampled = _(PFtest.int().sampled(.1))
  console.log('Pintsampled');
  console.log(Pintsampled.pluck('y').toArray());
  console.log(_(PFtest.polys).pluck('poly').pluck('coefs').toArray());

  var chart2 = semiChart()
  d3.select('body')
    .append('div')
    .datum(Pintsampled)
    .call(chart2)
}

function semiChart() {
  var p = {
    margin: {top: 20, right: 20, bottom: 20, left: 20},
    width: 600,
    height: 300,
    xScale: d3.scale.linear(),
    yScale: d3.scale.linear(),
    line: d3.svg.line().x(X).y(Y)
  }

  function chart(selection) {
    selection.each(function(data) {
      p.xScale
        .domain([-2, 2])
        .range([0, p.width - p.margin.left - p.margin.right])

      p.yScale
        .domain([-1, 1])
        .range([p.height - p.margin.top - p.margin.bottom, 0])

      // Select the svg element, if it exists.
      var svg = d3.select(this).selectAll('svg').data([data.toArray()])

      // Otherwise, create the skeletal chart.
      var gEnter = svg.enter().append('svg').append('g')
      // gEnter.append('path').attr('class', 'line')
      svg.select('g').selectAll('circle')
      .data(data.toArray())
      .enter().append('circle')
      .attr('cx', function(d) {return X(d)})
      .attr('cy', function(d) {return Y(d)})
      .attr('r', 2)

      svg.attr('width', p.width)
         .attr('height', p.height)

      var g = svg.select('g')
        .attr('transform', 'translate(' + p.margin.left + ',' + p.margin.top + ')')
    })
  }

  chart.update = function(selection) {
    selection.each(function(data) {

      // var svg = d3.select(this).selectAll('svg').data([data.toArray()])
      var svg = d3.select(this).selectAll('svg')
      // svg.select('g').select('.line')
      //   .attr('d', line)
      // })
      var upd = svg.select('g').selectAll('circle')
      .data(data.toArray())

      upd.enter().append('circle')

      upd.attr('cx', function(d) {return X(d)})
      .attr('cy', function(d) {return Y(d)})
      .attr('r', 2)

      upd.exit().remove()

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