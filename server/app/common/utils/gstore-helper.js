var rp = require('request-promise');
const Constants = require('../constants');
const DatabusMessage = require('../databus-message');


class GstoreHelper {

  static async read(repo, path) {
    let options = {
      url: `${process.env.DATABUS_DATABASE_URL}/graph/read?repo=${repo}&path=${path}`,
      headers: {
        'Accept': 'application/ld+json'
      },
      json: true
    };

    try {
      var res = await rp.get(options);
      return res;

    } catch (err) {
      return null;
    }
  }

  static async save(repo, path, content) {

    try {
      var options = {
        uri: `${process.env.DATABUS_DATABASE_URL}/graph/save?repo=${repo}&path=${path}`,
        body: content,
        json: true
      };

      var res = await rp.post(options);

      process.send({
        id: DatabusMessage.REQUEST_SEARCH_INDEX_REBUILD
      });

      return { isSuccess: true };
    } catch (err) {
      console.log(err);
      return { isSuccess: false };
    }

  }

  static async delete(repo, path) {

    try {

      var uri = `${process.env.DATABUS_DATABASE_URL}/graph/delete?repo=${repo}&path=${path}`;
      var res = await rp.delete(uri);

      process.send({
        id: DatabusMessage.REQUEST_SEARCH_INDEX_REBUILD
      });

      return { isSuccess: true };
    } catch (err) {
      console.log(err);
      return { isSuccess: false };
    }

  }

}

module.exports = GstoreHelper;