// representation of a polynomial function
// coefs = [a0, a1, a2, a3, ...]
var Poly = function(_coefs) {
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
        if (typeof(range) === 'object')
          dx = (b-a)/40.01
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

var PolyFunc = function(_polys) {
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

var P = {}
P.Poly = Poly
P.PolyFunc = PolyFunc