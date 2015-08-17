#!/usr/bin/env node
var fs = require('fs');
var TP = require('ts-tinkerpop');
var gremlinGraphviz = require('gremlin-graphviz');

TP.getTinkerpop()
  // Create a Gremlin graph with some data.
  .then(function() { return TP.TinkerFactory.createModernP(); })
  // Create a Graphviz graph (promise) representing the Gremlin graph.
  .then(function(gremlinGraph) { return gremlinGraphviz(gremlinGraph); })
  .then(function(graphvizGraph) {
    // Create a dot representation (synchronous).
    var dotGraph = graphvizGraph.to_dot();

    // Create a force-directed graph PNG (async).
    graphvizGraph.use = 'fdp';
    graphvizGraph.output('png', function (data) {

      // Save it as a file.
      fs.writeFileSync('baseline.png', data);

    }, function (code, stdout, stderr) {
      // If something goes wrong with the 'fdp' command...
      throw new Error('fdp failed: ' + stderr);
    });
  });
