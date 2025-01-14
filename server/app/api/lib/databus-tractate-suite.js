const rdfParser = require("rdf-parse").default;
const fs = require('fs');
var rp = require('request-promise');
const NodeRSA = require('node-rsa');
var JsonldUtils = require('../../../../public/js/utils/jsonld-utils');
var jsonld = require('jsonld');
const autocompleter = require('./dataid-autocomplete');
const DatabusUris = require('../../../../public/js/utils/databus-uris');
const Constants = require('../../common/constants');
var fileAnalyzer = require('../../common/file-analyzer');
var GstoreHelper = require('../../common/utils/gstore-helper');
var requestRdf = require('../../common/request-rdf');

var tractateConfig = {
  header: 'Databus Tractate Version 1.0',
  publisherProperty: 'http://purl.org/dc/terms/publisher',
  versionProperty: 'http://dataid.dbpedia.org/ns/core#version',
  licenseProperty: 'http://purl.org/dc/terms/license',
  distributionProperty: 'http://www.w3.org/ns/dcat#distribution',
  sha256sumProperty: 'http://dataid.dbpedia.org/ns/core#sha256sum',
  proofProperty: 'https://w3id.org/security#proof',
  signatureProperty: 'https://w3id.org/security#signature'
}

// Signature (and tractate?) generation
var signer = {};

signer.init = function () {
  if (signer.privateKey != undefined) {
    return;
  }

  var privateKeyFile = __dirname + '/../../../keypair/private-key.pem';
  var encodedPrivateKeyString = fs.readFileSync(privateKeyFile, "utf8");

  signer.privateKey = new NodeRSA(encodedPrivateKeyString, 'pkcs8');
}

signer.tryAnalyzeParts = async function (expandedGraph) {
  var distributions = JsonldUtils.getTypedGraphs(expandedGraph, DatabusUris.DATAID_PART);

  for (var distribution of distributions) {

    if (distribution[DatabusUris.DATAID_SHASUM] != undefined) {
      continue;
    }

    var downloadURL = distribution[DatabusUris.DCAT_DOWNLOAD_URL][0][DatabusUris.JSONLD_ID];
    var analyzeResult = await fileAnalyzer.analyzeFile(downloadURL, function (msg) {

    });

    if (analyzeResult.code != 200) {
      throw analyzeResult;
    }

    distribution[DatabusUris.DATAID_SHASUM] = [{}];
    distribution[DatabusUris.DATAID_SHASUM][0][DatabusUris.JSONLD_VALUE] = analyzeResult.data.shasum;
  }
}

signer.expandAndCanonicalize = async function (graph) {
  var expandedGraph = await jsonld.flatten(await jsonld.expand(graph));
  autocompleter.autocomplete(expandedGraph);
  await this.tryAnalyzeParts(expandedGraph);
  return signer.canonicalize(expandedGraph);
}


signer.canonicalize = function (expandedGraph) {

  var datasetGraph = JsonldUtils.getTypedGraph(expandedGraph, DatabusUris.DATAID_DATASET);

  var tractate = '';
  tractate += `${tractateConfig.header}\n`;
  tractate += `${JsonldUtils.getFirstObjectUri(datasetGraph, tractateConfig.publisherProperty)}\n`;
  tractate += `${JsonldUtils.getFirstObjectUri(datasetGraph, tractateConfig.versionProperty)}\n`;
  tractate += `${JsonldUtils.getFirstObjectUri(datasetGraph, tractateConfig.licenseProperty)}\n`;

  var shasums = [];

  var distributionGraphs = JsonldUtils.getTypedGraphs(expandedGraph, DatabusUris.DATAID_PART);

  for (var d in distributionGraphs) {
    var distributionGraph = distributionGraphs[d];
    var shasum = JsonldUtils.getFirstObject(distributionGraph, DatabusUris.DATAID_SHASUM);

    if (shasum != null) {
      shasums.push(shasum['@value']);
    }
  }

  shasums.sort();

  for (var s in shasums) {
    tractate += `${shasums[s]}\n`;
  }

  return tractate;
}

signer.createProof = function (datasetGraph) {

  return {
    '@type': [DatabusUris.DATABUS_TRACTATE_V1],
    'https://w3id.org/security#signature': [{
      "@type": "http://www.w3.org/2001/XMLSchema#string",
      "@value": signer.sign(signer.canonicalize(datasetGraph))
    }]
  };
}

function getObjectValues(quads, subject, predicate) {

  // console.log(`Getting object values for <${subject}> <${predicate}> ?o...`);
  var values = [];
  var resultQuads = quads.filter(quad => quad.subject.value == subject && quad.predicate.value == predicate);
  for (var r in resultQuads) {
    values.push(resultQuads[r].object.value);
  }

  return values;
}

signer.validate = async function (canonicalized, proof) {

  try {
    var signature = proof[DatabusUris.SEC_SIGNATURE][0][DatabusUris.JSONLD_VALUE];
    var tractateLines = canonicalized.split('\n');
    var publisherUri = tractateLines[1];


    var isInternalWebId = publisherUri.startsWith(process.env.DATABUS_RESOURCE_BASE_URL);

    var quads = [];

    if (isInternalWebId) {
      // Parse the WebId URL
      var webIdURL = new URL(publisherUri);
      // Extract the pathname of the URL without leading slash
      var repo = webIdURL.pathname.substring(1);
      // Read the WebId directly from the Gstore to avoid access problems in private mode
      var content = JSON.stringify(await GstoreHelper.read(repo, Constants.DATABUS_FILE_WEBID));
      quads = await requestRdf.parseRdf(Constants.HTTP_CONTENT_TYPE_JSONLD, content)

    } else {
      // Get the WebId via HTTP request
      quads = await requestRdf.requestQuads(publisherUri);
    }

      
    var keyNodes = getObjectValues(quads, publisherUri, DatabusUris.CERT_KEY);

    for (var k in keyNodes) {

      var keyNode = keyNodes[k];
      var modulus = getObjectValues(quads, keyNode, DatabusUris.CERT_MODULUS);
      var exponent = getObjectValues(quads, keyNode, DatabusUris.CERT_EXPONENT);

      if (modulus.length != 1 || exponent.length != 1) {
        continue;
      }

      // Gotta love javascript madness
      modulus = modulus[0];
      exponent = exponent[0];

      // console.log(`RSA key found. Creating key with modulus/exponent\n${modulus} / ${exponent}\n`);

      var key = new NodeRSA();
      key.importKey({
        n: Buffer.from(modulus, 'hex'),
        e: parseInt(exponent)
      }, 'components-public');

      // console.log(`Verifying Signature:\n\n${signature} \n\nagainst: \n\n${canonicalized}`);
      if (key.verify(Buffer.from(canonicalized), Buffer.from(signature, 'base64'))) {
        // console.log(`Verification successful.`);
        return true;
      }

    }

    return false;
  } catch (err) {
    console.log(err);
    console.log('Failed to verify:' + err);
    return false;
  }
}

signer.sign = function (canonicalized) {

  // console.log(`Signing: \n${canonicalized}`);
  signer.init();
  var data = Buffer.from(canonicalized);
  
  var sign = signer.privateKey.sign(data);
  var signature = sign.toString('base64');
  // console.log(`Result:\n${signature}`);

  return signature;
};





module.exports = signer;