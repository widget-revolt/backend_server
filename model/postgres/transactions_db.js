//
//	Copyright (c) 2014 Widget Revolt LLC.  All rights reserved
//
//	Permission is hereby granted, free of charge, to any person obtaining a copy
//	of this software and associated documentation files (the "Software"), to deal
//	in the Software without restriction, including without limitation the rights
//	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//	copies of the Software, and to permit persons to whom the Software is
//	furnished to do so, subject to the following conditions:
//
//	The above copyright notice and this permission notice shall be included in
//	all copies or substantial portions of the Software.
//
//	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//	THE SOFTWARE.


"use strict";
var util = require('util');

var ServerConfig = require("../../config").ServerConfig;
var PG = require('pg');
if(ServerConfig.DEPLOY_ENVIRONMENT != "development") {
	PG = require('pg').native;
}

var Logger = require("../../log").getLogger();

///////////////////////////////////////////////////////
// Const



///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES TRANSACTIONS ===");

	var retObj = new TransactionDB(inName, inConnectString);
	return retObj;
};

///////////////////////////////////////////////////////
function TransactionDB(inName, inConnectString)
{

	this._mName = inName;
	this._mConnectString = inConnectString;
}

//--------------------------------------------------
// send a user_uuid to delete
TransactionDB.prototype.testAPIClearDatabase = function(uuid,callback)
{
	var connectString = this._mConnectString;
	var queryStr = "DELETE from transactions where user_uuid=$1";
	var queryParams = [uuid];

	PG.connect(connectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("** deleted transactions for API testing **");
			callback(null, resultObj);

		});//query()
	});//connect()

};

//--------------------------------------------------
TransactionDB.prototype.createTransactionRecord = function(dateCreate, userUUID, userOdin, platform, productId, itmsReceipt, itemPrice)
{
	var itmsTransactionId = itmsReceipt["transaction_id"];
	if(platform == "android") {
		itmsTransactionId = itmsReceipt["orderId"];
	}
	var theTransactionId = itmsReceipt["original_transaction_id"];

	if(!theTransactionId || theTransactionId == "") {
		theTransactionId = itmsTransactionId;
	}

	var theItemPrice = itemPrice || 0;


	return(
	{
		"date_create": dateCreate,
		"user_uuid": userUUID,
		"user_odin": userOdin,
		"platform": platform,
		"product_id": productId,
		"item_price": theItemPrice,
		"transaction_id": theTransactionId,
		"itms_receipt": itmsReceipt

	});
};
//--------------------------------------------------
// this used to be the find function.  Used in views.js for transactions per user
// pass limit null for no limit
TransactionDB.prototype.findAllTransactionsForUser = function(uuid, limit, callback)
{


	LOGDEBUG("looking for uuid:" + uuid);

	var self = this;


	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = "SELECT * from transactions where user_uuid = $1";
		if(limit != null) {
			queryStr += " LIMIT " + limit;
		}
		queryStr += ";";

		client.query(queryStr, [uuid], function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = null;
			if(result.rows.length == 0) {
				// don't throw an error here.. we just don't have a record
				var errStr = "No records for uuid: " + uuid;
				LOGERROR(errStr);
			}

			resultObj = result.rows;

			callback(null, resultObj);
		});//query()
	});


};

//--------------------------------------------------
TransactionDB.prototype.findOne = function(userUUID, transactionId, callback)
{

	LOGDEBUG("looking for transactionId:" + transactionId);

	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = "SELECT * FROM transactions WHERE user_uuid = $1 AND transaction_id = $2;";
		var queryParams = [userUUID, transactionId];

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = null;
			if(result.rows.length == 0) {
				// don't throw an error here.. we just don't have a record
				var errStr = "Transaction id not found:" + transactionId;
				LOGERROR(errStr);
			}
			else
			{
				resultObj = result.rows[0];
			}

			LOGDEBUG("found tran id:" + transactionId);
			callback(null, resultObj);
		});//query()
	});//connect()
};

//--------------------------------------------------
TransactionDB.prototype.countAndSum = function(inQueryStr, queryParams, callback)
{


	var self = this;
	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		var queryStr = 'SELECT count(*) as count, sum(item_price) as total from transactions';
		if(inQueryStr) {
			queryStr = 'SELECT count(*) as count, sum(item_price) as total from transactions where ' + inQueryStr + ';';
		}


		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err, -1);
				return;
			}

			// result pair is contains "count" and "total"
			var resultRow = result.rows[0];
			callback(null, resultRow);


		});
	});
};

//--------------------------------------------------
//TODO: use a transaction.
TransactionDB.prototype.insertTransaction = function(transactionObj, callback)
{
	// write with confirm
	LOGDEBUG("saving transaction: " + transactionObj["transaction_id"]);

	var qObj = createInsertUpdateQuery("INSERT", transactionObj);
	var queryStr = qObj["queryStr"];
	var queryParams = qObj["queryParams"];


	var self = this;

	PG.connect(self._mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err);
			return;
		}

		client.query(queryStr, queryParams, function(err, result) {
			//call `done()` to release the client back to the pool
			done();

			if(err) {
				LOGERROR("Error running query, " + err);
				callback(err);
				return;
			}

			// any results?
			var resultObj = result;

			LOGDEBUG("inserted record");
			callback(null, resultObj);
		});//query()
	});//connect()

};


/***

 //--------------------------------------------------
 // returns a cursor to the result set
 TransactionDB.prototype.find = function(query)
 {
	LOGDEBUG("transactionDB find");

	var cursor = this._mCollection.find(query);
	return cursor;
};



 */


///////////////////////////////////////////////////////
// Private Util Methods

//-----------------------------------------------------
function createInsertUpdateQuery(inType, transObj)
{

	/*

	 "date_create": dateCreate,
	 "user_uuid": userUUID,
	 "user_odin": userOdin,
	 "platform": platform,
	 "product_id": productId,
	 "item_price": theItemPrice,
	 "transaction_id": theTransactionId,
	 "itms_receipt": itmsReceipt
	 */
	var queryParams = [
		transObj.user_uuid,		//REQUIRED
		transObj.user_odin || "",
		transObj.platform,		//REQUIRED
		transObj.product_id,	//REQUIRED
		transObj.item_price || 0,
		transObj.transaction_id,	//REQUIRED
		transObj.itms_receipt

	];

	//ONLY update supported
	var queryStr;
	queryStr = "INSERT INTO transactions(date_create, user_uuid, user_odin, platform, product_id, item_price, transaction_id, itms_receipt) "
		+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7);";

	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}

function LOGINFO(s) {
	Logger.info("Database", s);
}
function LOGDEBUG(s) {
	Logger.debug("Database", s);
}
function LOGERROR(s) {
	Logger.error("Database", s, false);
}
function LOGCRITICAL(s) {
	Logger.error("Database", s, true);
}
