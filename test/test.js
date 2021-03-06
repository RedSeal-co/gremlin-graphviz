// test/test.js
// Unit tests for gremlin-graphviz.

var _ = require('lodash');
var BluePromise = require('bluebird');
var chai = require('chai');
var debug = require('debug');
var glob = require('glob');
var gremlinGraphviz = require('../lib/index.js');
var heredoc = require('heredoc');
var path = require('path');
var tsTinkerpop = require('ts-tinkerpop');
var xmldom = require('xmldom');
var xpath = require('xpath');

var dlog = debug('gremlin-graphviz:test');
var expect = chai.expect;

var TP;

before(function (done) {
  dlog('BEFORE: global');

  tsTinkerpop.getTinkerpop()
    .then(function (tp) {
      TP = tp;
      dlog('TP initialized');
      done();
    });
});

describe ('gremlin-graphviz', function () {

  it ('loads via require', function () {
  });

  it ('exports a function', function () {
    expect(gremlinGraphviz).to.be.ok;
    expect(_.isFunction(gremlinGraphviz)).to.be.true;
  });

  // ## with empty graph as input
  // Tests using an empty in-memory TinkerGraph database instance.
  describe ('with empty graph as input', function () {

    var graph;

    before(function () {
      dlog('BEFORE: with empty graph as input');
      graph = TP.TinkerGraph.open();
      expect(graph).to.exist;
    });

    after(function (done) {
      if (graph) {
        graph.closeP()
          .then(function() {
            graph = null;
          })
          .done(done);
      } else {
        done();
      }
    });

    it ('test harness should initialize', function () {
    });

    it ('returns a promise', function () {
      var promise = gremlinGraphviz(graph);
      expect(promise instanceof BluePromise).to.be.true;
    });

    it ('accepts promises', function (done) {
      gremlinGraphviz(BluePromise.resolve(graph), BluePromise.resolve({}))
        .then(function (g) {
          expect(g).to.be.ok;
        })
        .done(done);
    });

    it ('returns a digraph', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.type).to.equal('digraph');
        })
        .done(done);
    });

    it ('returns a graph with a default ID', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.id).to.equal('G');
        })
        .done(done);
    });

    it ('contains no vertices and edges', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.nodeCount()).to.equal(0);
          expect(g.edgeCount()).to.equal(0);
        })
        .done(done);
    });

    it ('can be rendered as dot', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.to_dot()).to.equal('digraph G {\n}\n');
        })
        .done(done);
    });
  });

  // ## with classic graph as input
  // Tests using the classic in-memory TinkerGraph database instance.
  describe ('with classic graph as input', function () {

    var graph;

    before(function () {
      dlog('BEFORE: with classic graph as input');
      graph = TP.TinkerFactory.createClassic();
      expect(graph).to.exist;
    });

    after(function (done) {
      if (graph) {
        graph.closeP()
          .then(function() {
            graph = null;
          })
          .done(done);
      } else {
        done();
      }
    });

    it ('test harness should initialize', function () {
    });

    it ('contains vertices and edges', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.nodeCount()).to.equal(6);
          expect(g.edgeCount()).to.equal(6);
          expect(g.getNode('1').id).to.equal('1');
        })
        .done(done);
    });

    it ('can be rendered as dot', function (done) {
      var expected = heredoc(function () {/*
digraph G {
  "1";
  "2";
  "3";
  "4";
  "5";
  "6";
  "1" -> "2";
  "1" -> "4";
  "1" -> "3";
  "4" -> "5";
  "4" -> "3";
  "6" -> "3";
}
*/});

      gremlinGraphviz(graph)
        .then(function (g) {
          expect(g.to_dot()).to.equal(expected);
        })
        .done(done);
    });

    it ('allows specifying alternate vertex ID', function (done) {
      var expected = heredoc(function () {/*
digraph G {
  "marko";
  "vadas";
  "lop";
  "josh";
  "ripple";
  "peter";
  "marko" -> "vadas";
  "marko" -> "josh";
  "marko" -> "lop";
  "josh" -> "ripple";
  "josh" -> "lop";
  "peter" -> "lop";
}
*/});

      gremlinGraphviz(graph, { vertexId: gremlinGraphviz.util.vertexAttributeGetter('name') })
        .then(function (g) {
          expect(g.to_dot()).to.equal(expected);
        })
        .done(done);
    });

    it ('allows specifying alternate edge label', function (done) {
      var expected = heredoc(function () {/*
digraph G {
  "1";
  "2";
  "3";
  "4";
  "5";
  "6";
  "1" -> "2" [ label = "knows" ];
  "1" -> "4" [ label = "knows" ];
  "1" -> "3" [ label = "created" ];
  "4" -> "5" [ label = "created" ];
  "4" -> "3" [ label = "created" ];
  "6" -> "3" [ label = "created" ];
}
*/});

      gremlinGraphviz(graph, { edgeLabel: gremlinGraphviz.util.getEdgeLabel })
        .then(function (g) {
          expect(g.to_dot()).to.equal(expected);
        })
        .done(done);
    });

    it ('can be rendered as force-directed graph in SVG', function (done) {
      gremlinGraphviz(graph)
        .then(function (g) {
          g.use = 'fdp';
          g.output('svg', function (svgData) {

            // Parse DOM of SVG data.
            var svgDoc = new xmldom.DOMParser().parseFromString(svgData.toString());
            expect(svgDoc).to.be.ok;

            // Check that we have an ellipse for each vertex.
            var ellipses = findNodes('ellipse', svgDoc);
            expect(ellipses).to.be.ok;
            expect(ellipses.length).to.equal(6);

            // Check that we have a path for each edge.
            var paths = findNodes('path', svgDoc);
            expect(paths).to.be.ok;
            expect(paths.length).to.equal(6);

            done();
          }, function (code, out, err) {
            done('Code: ' + code + '\nError:' + err);
          });
        });
    });

    it ('allows graph properties to be set/get', function () {
      return gremlinGraphviz(graph)
        .then(function (g) {
          // Set a valid graph property that should appear in the DOT.  The valid set of properties are validated by
          // Graphviz at runtime.
          g.set('splines', true);
          expect(g.get('splines')).to.equal(true);
          expect(g.to_dot()).to.contain('splines = "true"');
        });
    });

    it ('allows global node properties to be set/get', function () {
      return gremlinGraphviz(graph)
        .then(function (g) {
          g.setNodeAttribut('color', 'blue');
          expect(g.getNodeAttribut('color')).to.equal('blue');
          expect(g.to_dot()).to.contain('node [ color = "blue" ]');
        });
    });

    it ('allows global edge properties to be set/get', function () {
      return gremlinGraphviz(graph)
        .then(function (g) {
          g.setEdgeAttribut('color', 'blue');
          expect(g.getEdgeAttribut('color')).to.equal('blue');
          expect(g.to_dot()).to.contain('edge [ color = "blue" ]');
        });
    });

    it ('allows individual node properties to be set/get', function () {
      return gremlinGraphviz(graph)
        .then(function (g) {
          var node1 = g.getNode('1');
          node1.set('color', 'blue');
          expect(node1.get('color')).to.equal('blue');
          expect(g.to_dot()).to.contain('"1" [ color = "blue" ]');
        });
    });

  });

  // Find XML nodes with specific local name.
  var findNodes = function (localName, doc) {
    return xpath.select("//*[local-name(.)='" + localName + "']", doc);
  };
});
