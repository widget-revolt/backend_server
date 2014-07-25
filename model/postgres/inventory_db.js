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
var Utils = require("../../lib/utils.js");

//-----------------
// sample
//	{
//		"status": "inactive",
//		"product_id": "com.widgetrevolt.icetales.tokens_1",
//		"platform": "both",
//		"iap_type": "consumable",
//
//		"name": "Tiny Bag O' Tokens",
//		"description": "A Tiny Bag of Tokens",
//
//		"currency_type": "currency_tokens",
//		"rank": 100,
//		"currency_amount": 30,
//		"current_price": 2.99,
//		"suggested_price": 2.99,
//		"highlight": "none",
//		"tab": "page1"
//	}

///////////////////////////////////////////////////////
// Const



///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inName, inConnectString)
{
	LOGINFO("=== POSTGRES INVENTORY ===");

	var retObj = new InventoryDB(inName, inConnectString);
	return retObj;
};



///////////////////////////////////////////////////////
function InventoryDB(inName, inConnectString)
{
	this.mName = inName;//appname
	this.mConnectString = inConnectString;

	//TODO: make this use standard naming _mNNNNNN
}



//--------------------------------------------------
function paramsToObj(status, productId,
														platform,
														iapType,
														name,
														description,
														currencyType,
														currencyAmount,
														currentPrice,
														suggestedPrice,
														rank,
														highlight,
														tab,
														icon)
{
	var params = {
		"status": status,

		"product_id": productId,
		"platform": platform,
		"iap_type": iapType,

		"name": name,
		"description": description,

		"currency_type": currencyType,
		"currency_amount": currencyAmount,
		"current_price": currentPrice,

		"suggested_price": suggestedPrice,
		"rank": rank,
		"highlight": highlight,
		"tab": tab,
		"icon": icon
	};

	return params;
}

//--------------------------------------------------
InventoryDB.prototype.insertRecordWithParams = function(productId,
													  platform,
													  iapType,
													  name,
													  description,
													  currencyType,
													  currencyAmount,
													  currentPrice,
													  suggestedPrice,
													  rank,
													  highlight,
													  tab,
													  icon,
													  callback)
{
	var params = paramsToObj("inactive", productId,
		platform,
		iapType,
		name,
		description,
		currencyType,
		currencyAmount,
		currentPrice,
		suggestedPrice,
		rank,
		highlight,
		tab,
		icon);

	this.insertRecord(params, callback);
};

//-----------------------------------------------------
function createInsertUpdateQuery(inType, inventoryObj)
{

	//UPDATE unsupported

	var queryParams = [
		inventoryObj.status,
		inventoryObj.product_id || "",
		inventoryObj.platform || "",
		inventoryObj.iap_type || "",

		inventoryObj.name || "",
		inventoryObj.description || "",

		inventoryObj.currency_type || "",
		inventoryObj.currency_amount || 0,
		inventoryObj.current_price || 0,			// required

		inventoryObj.suggested_price  || 0,
		inventoryObj.rank  || 100,
		inventoryObj.highlight  || "",
		inventoryObj.tab  || "",
		inventoryObj.icon || ""

	];

	

	var queryStr;

		queryStr = "INSERT INTO inventory(date_create, status, product_id, platform, iap_type, name, description, currency_type, currency_amount, current_price, suggested_price, rank, highlight, tab, icon) "
			+ "VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);";



	var retObj = {
		"queryStr":queryStr,
		"queryParams": queryParams
	};

	return retObj;

}


//--------------------------------------------------
InventoryDB.prototype.insertRecord = function(inParams, callback)
{
	var productId = inParams["product_id"];
	if(Utils.isEmptyString(productId)) {
		callback("Invalid product id in createItem record", null);
		return;
	}

	var self = this;
	self.findOne(productId, function(err, result){

		// if we have a result then the item exists...return an error
		if(result)
		{
			var errStr = util.format("Product id exist")
			callback("ERROR: product id already exists: " + productId);
			return;
		}

		// save it
		var qObj = createInsertUpdateQuery("INSERT", inParams);
		var queryStr = qObj["queryStr"];
		var queryParams = qObj["queryParams"];

		PG.connect(self.mConnectString, function(err, client, done) {

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

				LOGDEBUG("inserted record");
				callback(null);
			});//query()
		});//connect()


	});

};

//--------------------------------------------------
InventoryDB.prototype.setStatus = function(productId, status, callback)
{
	var validStatus = {
		"active": 1,
		"inactive": 1
	};
	if(!validStatus[status])
	{
		var errStr = "setStatus, invalid status: " + status;
		LOGERROR(errStr);
		callback(errStr);
		return;
	}

	var self = this;

	var queryStr = "UPDATE inventory SET status=$1 WHERE product_id = $2";
	var queryParams = [status, productId];

	PG.connect(self.mConnectString, function(err, client, done) {

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

			LOGDEBUG("updated record");
			callback(null);
		});//query()
	});//connect()

};

//--------------------------------------------------
InventoryDB.prototype.update = function(productId,	// updates product id with data
										name,
										description,
										currencyAmount,
										currentPrice,
										suggestedPrice,
										rank,
										highlight,
										tab,
										icon,
										callback)
{

	var self = this;

	var queryStr = "UPDATE inventory SET (name, description, currency_amount, current_price, suggested_price, rank, highlight, tab, icon) = ($1, $2, $3, $4, $5, $6, $7, $8, $9) WHERE product_id = $10";
	var queryParams = [name,
		description,
		currencyAmount,
		currentPrice,
		suggestedPrice,
		rank,
		highlight,
		tab,
		icon,
		productId];

	PG.connect(self.mConnectString, function(err, client, done) {

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

			LOGDEBUG("updated record");
			callback(null);
		});//query()
	});//connect()



};

//--------------------------------------------------
// returns an error if not found
InventoryDB.prototype.findOne = function(productId, callback)
{
	LOGDEBUG("looking for productId:" + productId);

	var self = this;

	PG.connect(self.mConnectString, function(error, client, done) {

		if(error) {
			LOGERROR("Error fetching client from pool" + error);
			callback(error);
			return;
		}

		client.query('SELECT * from inventory where product_id = $1;', [productId], function(err, result) {
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
				LOGERROR("Item not found: " + productId);
				callback("Item not found: " + productId, null);
				return;
			}

			resultObj = result.rows[0];

			LOGDEBUG("found productId:" + productId);
			callback(null, resultObj);
		});
	});

};

//--------------------------------------------------
InventoryDB.prototype.findAllAsJSON = function(callback)
{

	var self = this;

	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "SELECT * FROM inventory ORDER BY status ASC, iap_type DESC, currency_type DESC, current_price ASC;";
		var queryParams = [];
		//result.sort( {status:1, iap_type: -1, currency_type: -1, current_price: 1} );

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			// any results?
			callback(null, result.rows);


		});//query()
	});//connect()

};

//--------------------------------------------------
InventoryDB.prototype.getActiveInventoryJSON = function(callback)
{

	var self = this;

	PG.connect(self.mConnectString, function(err, client, done) {

		if(err) {
			LOGERROR("Error fetching client from pool" + err);
			callback(err, null);
			return;
		}

		var queryStr = "SELECT * FROM inventory WHERE status=$1 ORDER BY status ASC, iap_type DESC, currency_type DESC, current_price ASC;";
		var queryParams = ["active"];
		//result.sort( {status:1, iap_type: -1, currency_type: -1, current_price: 1} );

		client.query(queryStr, queryParams, function(err, result) {

			//call `done()` to release the client back to the pool
			done();

			if(err) {
				callback(err, null);
				return;
			}

			// any results?
			callback(null, result.rows);


		});//query()
	});//connect()

};


///////////////////////////////////////////////////////
// Private Util Methods


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
