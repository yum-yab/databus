/**
 * Query Templates can be defined as object with the fields:
 * > select
 * > body
 * > aggregate
 * 
 * The select is a SPARQL select statement. The body is an array of strings with each string being a line of a 
 * SPARQL query. The string %QUERY% can be used to insert the query generated by the QueryBuilder. The aggregate
 * is a SPARQL aggregate statement.
 */
class SparqlExamples {

  static LIST = `PREFIX databus: <https://dataid.dbpedia.org/databus#>
SELECT DISTINCT * WHERE {
  ?s a databus:Artifact .
}`;
}

module.exports = SparqlExamples;