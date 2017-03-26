_ = Lazy

// physical constants
var e0 = 8.8542e-14 // F/cm
var kS = 11.9 // unitless
var q = 1.602e-19 // J
var T = 300 // K
var k = 1.381e-23 // J/K
var ni = 1e10 // 1/cm^3 | p*n=ni^2

/*
    pnJunction() holds all the pn junction state
        - auto-updates with getters/setters (#magic)
*/
function pnJunction(props) {
    /*
        depletion() calculates
            - depletion region width/proportion
            - current through the junction (not used yet)
    */
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
        var I = Is*Math.exp((q*VA)/(k*T)) - Is

        return {
            V0: V0,
            xp: xp,
            xn: xn
        }
    }

    // the #this of pnJunction (1/2)
    var junc = {
        update: function pn() {
            var NA = junc.p.NA
            var ND = junc.p.ND
            var VA = junc.p.VA
            var L = junc.p.L

            var dep = depletion(NA, ND, VA)
            junc.Vbi = dep.V0

            var block = [
                {
                    poly: P.Poly([0]),
                    range: [-L/2, -dep.xp],
                    type: 'p'
                },
                {
                    poly: P.Poly([-q*NA]),
                    range: [-dep.xp, 0],
                    type: 'pdep'
                },
                {
                    poly: P.Poly([q*ND]),
                    range: [0, dep.xn],
                    type: 'ndep'
                },
                {
                    poly: P.Poly([0]),
                    range: [dep.xn, L/2],
                    type: 'n'
                }
            ]
            // gets modified #in-place (1/2)
            var rho = new P.PolyFunc(block)

            junc.block = block
            junc.rho = _(rho.sampled())
            junc.efield = _(rho.int(0).mult(q/(kS*e0)).sampled())
            junc.V = _(rho.int(0).mult(-1/q).sampled())
            junc.bands = _(rho.mult(-q).sampled()) // yeah... #in-place (2/2)
            // junc.I = 
        }
    }

    // default pnJunction properties
    junc.p = {
        NA: 5e14,
        ND: 1e14,
        VA: 0,
        L: .002
    }
    junc.pInputs = {
        NA: {
            type: 'range',
            min: 1e14,
            max: 1e15
        },
        ND: {
            type: 'range',
            min: 1e14,
            max: 1e15
        },
        VA: {
            type: null
        },
        L: {
            type: null
        }
    }

    if (arguments.length)
        Object.keys(props).forEach(function(key) {
            junc.p[key] = props[key]
        })

    // generate getters/setters
    // this is the #magic (1/2)
    Object.keys(junc.p).forEach(function(key) {
        junc[key] = function(_) {
            if (!arguments.length) return junc.p[key]
            junc.p[key] = _
            junc.update()
            return junc
        }
    })

    junc.update()
    // see? #this (2/2)
    return junc
}

function createJuncInputs(junction, chart) {
    function updateParam(p) {
        param = parseInt(this.value)
        p = d3.select(this).attr('class')
        
        var upd = {}
        upd[p] = param
        chart.update(upd)
    }

    for (p in junction.pInputs) {
        var inputInfo = junction.pInputs[p]
        switch (inputInfo.type) {
            case 'range':
                d3.select('#controls')
                    .insert('input')
                    .attr('type', 'range')
                    .attr('min', inputInfo.min)
                    .attr('max', inputInfo.max)
                    .attr('class', p)
                    .on('input', updateParam)
                break

            default:
                break
        }
    }
}

window.onload = function() {
    var junction = new pnJunction({
        NA: 1e14,
        ND: 4e14,
        VA: 0,
        L: .002
    })

    var PNC = pnChart(junction)

    createJuncInputs(junction, PNC)

    _(['NA', 'ND']).each(function (param) {
        d3.select('button.'+param)
            .on('click', function() {
                var upd = {}

                var paramIn = Number(d3.select('input.'+param).property('value'))
                if (paramIn >= junction.minN() && paramIn <= junction.maxN())
                        upd[param] = paramIn
                PNC.update(upd)
            })
    })
}

// calls all the plotting functions
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
            },
            bands: {
                title: 'Band Diagram',
                plot: semiChart()
            }
        },
        update: function updatepnChart(opts) {
            Object.keys(opts).forEach(function(key) {
                // that enables this unintelligible #magic (2/2)
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
            var V = chart.subs.V.plot
                .yScale().invert(d3.mouse(this)[1]-chart.subs.V.plot.margin().bottom)
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

// plots charge density/e-field/voltage
// charge density plot fill is done in css
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

// plots semiconductor block diagram
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

// plots depletion region boundary lines
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