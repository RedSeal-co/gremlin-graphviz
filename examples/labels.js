#!/usr/bin/env node
var fs = require('fs');
var TP = require('ts-tinkerpop');
var gremlinGraphviz = require('gremlin-graphviz');

TP.getTinkerpop()
  // Create a Gremlin graph with some data.
  .then(function() { return TP.TinkerFactory.createModernP(); })
  // Create a Graphviz graph (promise) representing the Gremlin graph.
  .then(function(gremlinGraph) {
    return gremlinGraphviz(gremlinGraph, {
      // Use vertex name as the visible ID.
      vertexId: gremlinGraphviz.util.vertexAttributeGetter('name'),
      // Put the edge label on each edge.
      edgeLabel: gremlinGraphviz.util.getEdgeLabel,
    });
  })
  .then(function(graphvizGraph) {
    // Use splines to draw edges.
    graphvizGraph.set('splines', true);

    graphvizGraph.use = 'fdp';
    graphvizGraph.output('png', function (data) {

      // Save it as a file.
      fs.writeFileSync('labels.png', data);

    }, function (code, stdout, stderr) {
      // If something goes wrong with the 'fdp' command...
      throw new Error('fdp failed: ' + stderr);
    });
  })
  .catch(function(err) {
    console.error('Error: ' + err.toString());
  });
