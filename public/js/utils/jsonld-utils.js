var JsonldUris = undefined;

if (typeof module === "object" && module && module.exports) {
  JsonldUris = require("./databus-uris");
} else {
  JsonldUris = DatabusUris;
}

class JsonldUtils {

  static getTypedGraph(graphs, graphType) {

    for (var g in graphs) {
      var graph = graphs[g];

      if (graph[JsonldUris.JSONLD_TYPE] != undefined && graph[JsonldUris.JSONLD_TYPE].includes(graphType)) {
        return graph;
      }
    }

    return null;
  }

  static setLiteral(graph, property, type, value) {
    graph[property] = [];

    var entry = {};
    entry[JsonldUris.JSONLD_TYPE] = type;
    entry[JsonldUris.JSONLD_VALUE] = value;

    graph[property].push(entry);
  }

  static setLink(graph, property, uri) {
    graph[property] = [];

    var entry = {};
    entry[JsonldUris.JSONLD_ID] = uri;

    graph[property].push(entry);
  }

  static getProperty(graph, property) {
    if (graph[property] == undefined) {
      return null;
    }

    if (graph[property].length == 1) {
      var value = graph[property][0];

      if (value[JsonldUris.JSONLD_VALUE] != null) {
        return value[JsonldUris.JSONLD_VALUE];
      }

      if (value[JsonldUris.JSONLD_ID] != null) {
        return value[JsonldUris.JSONLD_ID];
      }

      return null;
    } else {
      var result = [];

      for (var value of graph[property]) {

        if (value[JsonldUris.JSONLD_VALUE] != null) {
          result.push(value[JsonldUris.JSONLD_VALUE]);
        }

        if (value[JsonldUris.JSONLD_ID] != null) {
          result.push(value[JsonldUris.JSONLD_ID]);
        }
      }

      if (result.length > 0) {
        return result;
      }
    }

    return null;
  }

  static getGraphById(graphs, id) {
    for (var g in graphs) {
      var graph = graphs[g];

      if (graph[JsonldUris.JSONLD_ID] != undefined && graph[JsonldUris.JSONLD_ID] == id) {
        return graph;
      }
    }

    return null;


  }

  static getTypedGraphs(graphs, graphType) {
    var result = [];

    for (var g in graphs) {
      var graph = graphs[g];

      if (graph[JsonldUris.JSONLD_TYPE] != undefined &&
        graph[JsonldUris.JSONLD_TYPE].includes(graphType)) {
        result.push(graph);
      }
    }

    return result;
  }

  static getSubPropertyGraphs(graphs, propertyUri) {

    var result = [];

    for (var graph of graphs) {
      if (graph[JsonldUris.RDFS_SUB_PROPERTY_OF] == undefined) {
        continue;
      }

      for (var property of graph[JsonldUris.RDFS_SUB_PROPERTY_OF]) {
        if (property[JsonldUris.JSONLD_ID] == propertyUri) {
          result.push(graph);
        }
      }
    }

    return result;
  }


  static getFirstObject(graph, key) {
    var obj = graph[key];

    if (obj == undefined || obj.length < 1) {
      return null;
    }

    return obj[0];
  }

  static getFirstObjectUri(graph, key) {
    var obj = graph[key];

    if (obj == undefined || obj.length < 1) {
      return null;
    }

    return obj[0][JsonldUris.JSONLD_ID];
  }
}



if (typeof module === "object" && module && module.exports)
  module.exports = JsonldUtils;