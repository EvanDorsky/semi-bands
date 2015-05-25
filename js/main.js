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

// physical constants
var e0 = 8.8542e-12; // F/m
var kS = 11.9;
var q = 1.602e-19; // J
var T = 300; // K
var k = 1.381e-23; // J/K
var ni = 1e10; // 1/cm^3 | p*n=ni^2

function updatepnPlot(newpn, rhoC, efieldC, EC) {
  d3.select('#rho')
  .datum(newpn.rho)
  .call(rhoC.update)
  
  d3.select('#efield')
  .datum(newpn.efield)
  .call(efieldC.update)
  
  d3.select('#E')
  .datum(newpn.E)
  .call(EC.update)
}

function plotpn(pnjunc) {
  var rhoC = pnChart();
  d3.select('body')
    .append('div')
    .attr('id', 'rho')
    .datum(pnjunc.rho)
    .call(rhoC)
    .call(rhoC.update)

  var efieldC = pnChart();
  d3.select('body')
    .append('div')
    .attr('id', 'efield')
    .datum(pnjunc.efield)
    .call(efieldC)
    .call(efieldC.update)

  var EC = pnChart();
  d3.select('body')
    .append('div')
    .attr('id', 'E')
    .datum(pnjunc.E)
    .call(EC)
    .call(EC.update)
    .on('mousemove', function() {
      var V = EC.yScale().invert(d3.mouse(this)[1]-EC.margin().bottom)
      if (V<.05)
        return

      pnjunc.VA(pnjunc.Vbi-V);
      updatepnPlot(pnjunc, rhoC, efieldC, EC)
    })
}

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

      junc.rho = _.range(-L/2, 0, L/2*dep.xp)
        .concat(_.range(0, L/2, L/2*dep.xn))
        .map(function charge(x) {
          if (-dep.xp < x && x < 0)
            return { x: x,y: -q*NA };

          if (0 < x && x < dep.xn)
            return { x: x, y: q*ND };

          return { x: x, y: 0 };
        }).memoize();

      junc.efield = integrate(junc.rho)
        .map(function(n) {
          return { x: n.x, y: q*n.y/(kS*e0) }
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

  // generate getters/setters
  Object.keys(p).forEach(function(key) {
    junc[key] = function(_) {
      if (!arguments.length) return junc;
      p[key] = _;
      junc.update();
      return junc;
    };
  })

  junc.update();
  return junc;
}

function makeplot(w, h) {
  return d3.select('body')
  .append('svg').attr('width', w).attr('height', h);
}

window.onload = function() {
  var NA = 5e14; // 1/cm^3
  var ND = 1e14; // 1/cm^3
  var VA = 0;
  var L = 0.02;

  // init options currently ignored
  var junction = new pnJunction({
    NA: NA,
    ND: ND,
    VA: VA,
    L: L
  });

  d3.select('button.NA')
    .on('click', function() {
      // var NAnew = parseInt(d3.select('input.NA')
      //   .property('value'))
      // updatepnPlot
    })

  plotpn(junction);
}

function pnChart() {
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
      gEnter.append('path').attr('class', 'line');

      svg.attr('width', width)
         .attr('height', height);

      var g = svg.select('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    });
  }

  chart.update = function(selection) {
    selection.each(function(data) {

    var svg = d3.select(this).selectAll('svg').data([data.toArray()]);
    svg.select('g').select('.line')
      .attr('d', line)
    });
    return chart;
  };

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