// lib/index.js

// Functions in this module are asynchronous, returning a promise if no callback is supplied.

'use strict';

var assert = require('assert');
var BluePromise = require('bluebird');
var debug = require('debug');
var graphviz = require('graphviz');
var TP = require('ts-tinkerpop');

var dlog = debug('gremlin-graphviz');

// Since we are given a gremlinGraph in the factory, we assume we can use TP without initializing it explicitly.

// Construct a Graphviz graph from a Gremlin graph.
// *opts* is an optional object allowing overriding default behavior:
// * *graphName*: Name of the Graphviz graph [default: 'G']
// * *vertexId*: Function that returns vertex ID string from a Gremlin vertex [default: util.getVertexId]
// * *TP*: ts-tinkerpop module to use (to avoid possible duplicate module)
var factory = module.exports = function (gremlinGraph, opts) {
  // Allow the arguments to be promises using BluePromise.all
  var args = Array.prototype.slice.call(arguments);
  var graphvizGraph;
  return BluePromise
    .all(args)
    .then(function (args) {
      gremlinGraph = args[0];
      assert(gremlinGraph);
      dlog('gremlinGraph:', gremlinGraph.toString());
      opts = args[1];
      graphvizGraph = new GraphvizGraph(gremlinGraph, opts);
      return;
    })
    .then(function () {
      var vertexTraversal = gremlinGraph.V();
      return TP.forEach(vertexTraversal, function (vertex) { addVertex(graphvizGraph, vertex); });
    })
    .then(function () {
      var edgeTraversal = gremlinGraph.E();
      return TP.forEach(edgeTraversal, function (edge) { addEdge(graphvizGraph, edge); });
    })
    .then(function () {
      return graphvizGraph;
    });
};

var GraphvizGraph = function (gremlinGraph, opts) {
  this.opts = opts || {};
  this.opts.TP = this.opts.TP || TP;
  var graphName = this.opts.graphName || 'G';
  this.impl = graphviz.digraph(graphName);
};

// Haul a property getter from the implementation class.
var haulProperty = function (name) {
  Object.defineProperty(GraphvizGraph.prototype, name,
                        { get: function () {
                          return this.impl[name];
                        }});
};

// ## Immutable properties
// Expose certain immutable properties of the graphviz graph.
['id',
 'type'
].map(haulProperty);

// Haul a property getter/setter from the implementation class.
var haulMutableProperty = function (name) {
  Object.defineProperty(GraphvizGraph.prototype, name,
                        {
                          get: function () {
                            return this.impl[name];
                          },
                          set: function (value) {
                            return this.impl[name] = value;
                          }
                        });
};

// ## Mutable properties
// Expose certain mutable properties of the graphviz graph.
['use'
].map(haulMutableProperty);

// Haul a method from the implementation class.
var haulMethod = function (name) {
  GraphvizGraph.prototype[name] = function () {
    // var args = Array.prototype.slice.call(arguments);
    return this.impl[name].apply(this.impl, arguments);
  };
};

// ## Methods
// All of the useful methods are exported.
[
  'addCluster',
  'addEdge',
  'addNode',
  'clusterCount',
  'edgeCount',
  'get',
  'getCluster',
  'getEdgeAttribut',
  'getNode',
  'getNodeAttribut',
  'nodeCount',
  'output',
  'render',
  'set',
  'setEdgeAttribut',
  'setGraphVizPath',
  'setNodeAttribut',
  'to_dot'
].map(haulMethod);

// Add a vertex (synchronously) to a Graphviz graph based on a Gremlin vertex.
var addVertex = function (graphvizGraph, gremlinVertex) {
  assert(graphvizGraph);
  assert(graphvizGraph.impl);
  assert(gremlinVertex);

  var vertexIdFunc = graphvizGraph.opts.vertexId || util.getVertexId;
  var vertexId = vertexIdFunc(gremlinVertex);
  dlog('addVertex', vertexId);
  graphvizGraph.impl.addNode(vertexId);
};

// Add an edge (synchronously) to a Graphviz graph based on a Gremlin edge.
var addEdge = function (graphvizGraph, gremlinEdge) {
  assert(graphvizGraph);
  assert(graphvizGraph.impl);
  assert(gremlinEdge);

  // Import the Direction enumeration
  var Direction = graphvizGraph.opts.TP.autoImport('Direction');
  assert(Direction);

  var vertexId = graphvizGraph.opts.vertexId || util.getVertexId;
  var iterators = gremlinEdge.iterators();
  var inV = iterators.vertexIterator(Direction.IN).next();
  assert(inV);
  var inId = vertexId(inV);
  var outV = iterators.vertexIterator(Direction.OUT).next();
  assert(outV);
  var outId = vertexId(outV);
  dlog('addEdge', outId.toString(), inId.toString());
  var graphvizEdge = graphvizGraph.impl.addEdge(outId.toString(), inId.toString());

  // See if we have to label the edge.
  var edgeLabeler = graphvizGraph.opts.edgeLabel;
  if (edgeLabeler) {
    var edgeLabel = edgeLabeler(gremlinEdge);
    if (edgeLabel) {
      graphvizEdge.set('label', edgeLabel);
    }
  };
};

// Import the utilities module.
var util = module.exports.util = require('./util.js');
