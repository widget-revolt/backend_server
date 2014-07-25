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
var crypto = require('crypto');

var ServerConfig = require("./config").ServerConfig;
var APP_CONFIG = require("./config").APP_CONFIG;

var Utils = require("./lib/utils.js");
var Logger = require('./log.js').getLogger();
var DatabaseManager = require("./model/database_manager.js");

require("./lib/ios_iap_validator.js");	// don't assign this to a var
var AndroidValidator = require("./lib/android_validator.js");

////////////////////////////////////////////////
// Constants

	//--DO NOT CHANGE THIS EVER
var kUUIDHashSalt = "widgetrevoltbackend";

var options =
{
	DEBUG: (ServerConfig.DEPLOY_ENVIRONMENT == "staging") || (ServerConfig.DEPLOY_ENVIRONMENT == "development") || ServerConfig.SERVER_DEBUG
};

////////////////////////////////////////////////
// Immediate
if(kUUIDHashSalt != "widgetrevoltbackend") 
{
	console.log("Quit FUCKING with the salt. You'll break all the clients");
	throw("die!");
	return;
}

//-------------------------------------------------------------
///--- API
// params
// *odin=ODIN  (SHA-1 Mac Address or ANDROID ID)
// *uuid=custom uuid
// *auth=salted uid (e.g "R0ck" + uuid + "St4r")
// *asid=apple advertiser id or blank if not enabled or android
// fbid=facebook id
// fname=first name
// lname=last name
// email=email@address.com
// bday=yyyyMMdd
// sexa=m or f (sex)
// platform=<android or ios>
// osvers=<os version string>
// device=<name of device e.g. iphone4 or samsung s3>
// carrier=<name of carrier>
// mcc=mcc
// mnc=mnc
// idfv = DO THIS!

exports.registerUser = function(req,res)
{
	//LOGDEBUG(req.body);

	// check for our required params
	var reqParams = [
		"odin",
		"uuid",
		"auth",
		"asid"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}



	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");
		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}


	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		LOGERROR("Could not find database");
		var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
		res.send(responseObject);

		return;
	}

	// build our mongo record
	//var responseObject = User.upsertFromQuery(req.body);
	var params = req.body;
	var uuid = params["uuid"];
	database.getUserCollection().upsertUserFromQuery(req.body, function (err, result)
	{

		var responseObject = {};
		if (err)
		{
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error on insert", "");

			res.send(responseObject);
		}
		else
		{


			// get the active config
			var appConfigDb = database.getAppConfigCollection();
			appConfigDb.getActiveConfig(function(err, result) {

				// we need to pass something valid here
				if(err) {
					LOGERROR("Error getting app config: " + err);
					responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error fetching app config", "");
					res.send(responseObject);
					return;
				}


				// save the result
				responseObject = result;

				// -- inventory
				var inventoryDb = database.getInventoryCollection();
				inventoryDb.getActiveInventoryJSON(function(err, result) {

					// only add inventory if we have a result
					if(err) {
						LOGERROR("Error fetching inventory");
					}

					if(result) {
						responseObject["_inventory"] = result;
					}

					// -- client users info
					var clientUsersDb = database.getClientUsersCollection();
					clientUsersDb.findOne(uuid, function(err, result) {

						// add if we hav a result
						if (err) {
							LOGERROR("Error fetching client user info");
						}

						if(result) {
							responseObject["_client_user"] = result["document"];
						}

						// -- promobanners
						var promoBannersDB = database.getPromoBannersCollection();
						promoBannersDB.getActivePromoJSON(function(err, result) {

							// add if we hav a result
							if (err) {
								LOGERROR("Error fetching promobanner info");
							}

							if(result) {
								responseObject["_promo_banners"] = result;
							}

							var responseObj = Utils.formatResponse(Utils.ERR_OK, "", responseObject);

							// DONE
							res.send(responseObj);

						});//findOne

					});//findOne


				});//getActiveInventoryJSON()


			});//getActiveConfig()


		}

	});
};


//-------------------------------------------------------------
exports.addUserInstallInfo = function(req,res)
{
	//LOGDEBUG(req.body);

	// check for our required params
	var reqParams = [
		"odin",
		"uuid",
		"auth",
		"asid"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");
		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}


	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		LOGERROR("Could not find database");
		var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
		res.send(responseObject);

		return;
	}

	// add the info
	var params = req.body;
	var uuid = params["uuid"];
	database.getUserCollection().upsertUserFromQuery(req.body, function (err, result)
	{

		var responseObject = {};
		if (err)
		{
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error on insert", "");
			res.send(responseObject);
			return; //EXIT
		}

		var responseObj = Utils.formatResponse(Utils.ERR_OK, "", responseObject);

		// DONE
		res.send(responseObj);

	});//upsertUserFromQuery
};
//-------------------------------------------------------------
//var testReceipt = "ewoJInNpZ25hdHVyZSIgPSAiQW5tblRuWlQxMnJwU0Fsc2EzbVNtc0lSc3o0T1c0aXB0NTBMQVk4MmgxazZaWXpRdzlNVUNyNnJTTTUwdlJJejNLQWkrQTRFTmVWa0FuaEVIUVVWRVUrQWNFN3lGYmhvY0wyK3ozSks2ajdYd0lhY09YZGs2S3dDUGZNMlRrQmJTa1pTTElJNVU2MHh6amtTVjNRNkNTSUJtZnU4Y1FUME1UcmdNUXAvcGgzUEFBQURWekNDQTFNd2dnSTdvQU1DQVFJQ0NHVVVrVTNaV0FTMU1BMEdDU3FHU0liM0RRRUJCUVVBTUg4eEN6QUpCZ05WQkFZVEFsVlRNUk13RVFZRFZRUUtEQXBCY0hCc1pTQkpibU11TVNZd0pBWURWUVFMREIxQmNIQnNaU0JEWlhKMGFXWnBZMkYwYVc5dUlFRjFkR2h2Y21sMGVURXpNREVHQTFVRUF3d3FRWEJ3YkdVZ2FWUjFibVZ6SUZOMGIzSmxJRU5sY25ScFptbGpZWFJwYjI0Z1FYVjBhRzl5YVhSNU1CNFhEVEE1TURZeE5USXlNRFUxTmxvWERURTBNRFl4TkRJeU1EVTFObG93WkRFak1DRUdBMVVFQXd3YVVIVnlZMmhoYzJWU1pXTmxhWEIwUTJWeWRHbG1hV05oZEdVeEd6QVpCZ05WQkFzTUVrRndjR3hsSUdsVWRXNWxjeUJUZEc5eVpURVRNQkVHQTFVRUNnd0tRWEJ3YkdVZ1NXNWpMakVMTUFrR0ExVUVCaE1DVlZNd2daOHdEUVlKS29aSWh2Y05BUUVCQlFBRGdZMEFNSUdKQW9HQkFNclJqRjJjdDRJclNkaVRDaGFJMGc4cHd2L2NtSHM4cC9Sd1YvcnQvOTFYS1ZoTmw0WElCaW1LalFRTmZnSHNEczZ5anUrK0RyS0pFN3VLc3BoTWRkS1lmRkU1ckdYc0FkQkVqQndSSXhleFRldngzSExFRkdBdDFtb0t4NTA5ZGh4dGlJZERnSnYyWWFWczQ5QjB1SnZOZHk2U01xTk5MSHNETHpEUzlvWkhBZ01CQUFHamNqQndNQXdHQTFVZEV3RUIvd1FDTUFBd0h3WURWUjBqQkJnd0ZvQVVOaDNvNHAyQzBnRVl0VEpyRHRkREM1RllRem93RGdZRFZSMFBBUUgvQkFRREFnZUFNQjBHQTFVZERnUVdCQlNwZzRQeUdVakZQaEpYQ0JUTXphTittVjhrOVRBUUJnb3Foa2lHOTJOa0JnVUJCQUlGQURBTkJna3Foa2lHOXcwQkFRVUZBQU9DQVFFQUVhU2JQanRtTjRDL0lCM1FFcEszMlJ4YWNDRFhkVlhBZVZSZVM1RmFaeGMrdDg4cFFQOTNCaUF4dmRXLzNlVFNNR1k1RmJlQVlMM2V0cVA1Z204d3JGb2pYMGlreVZSU3RRKy9BUTBLRWp0cUIwN2tMczlRVWU4Y3pSOFVHZmRNMUV1bVYvVWd2RGQ0TndOWXhMUU1nNFdUUWZna1FRVnk4R1had1ZIZ2JFL1VDNlk3MDUzcEdYQms1MU5QTTN3b3hoZDNnU1JMdlhqK2xvSHNTdGNURXFlOXBCRHBtRzUrc2s0dHcrR0szR01lRU41LytlMVFUOW5wL0tsMW5qK2FCdzdDMHhzeTBiRm5hQWQxY1NTNnhkb3J5L0NVdk02Z3RLc21uT09kcVRlc2JwMGJzOHNuNldxczBDOWRnY3hSSHVPTVoydG04bnBMVW03YXJnT1N6UT09IjsKCSJwdXJjaGFzZS1pbmZvIiA9ICJld29KSW05eWFXZHBibUZzTFhCMWNtTm9ZWE5sTFdSaGRHVXRjSE4wSWlBOUlDSXlNREV6TFRBMUxURXhJREUzT2pRM09qUXlJRUZ0WlhKcFkyRXZURzl6WDBGdVoyVnNaWE1pT3dvSkluVnVhWEYxWlMxcFpHVnVkR2xtYVdWeUlpQTlJQ0l3TURBd1lqQXlNVGczWWpnaU93b0pJbTl5YVdkcGJtRnNMWFJ5WVc1ellXTjBhVzl1TFdsa0lpQTlJQ0l4TURBd01EQXdNRGN6TnpJek9EVTRJanNLQ1NKaWRuSnpJaUE5SUNJeExqQWlPd29KSW5SeVlXNXpZV04wYVc5dUxXbGtJaUE5SUNJeE1EQXdNREF3TURjek56SXpPRFU0SWpzS0NTSnhkV0Z1ZEdsMGVTSWdQU0FpTVNJN0Nna2liM0pwWjJsdVlXd3RjSFZ5WTJoaGMyVXRaR0YwWlMxdGN5SWdQU0FpTVRNMk9ETXhPVFkyTWpZM01DSTdDZ2tpZFc1cGNYVmxMWFpsYm1SdmNpMXBaR1Z1ZEdsbWFXVnlJaUE5SUNJeE1URTJNMFZCT0MwMk1rWkNMVFE1UWtNdE9ETTBSaTB5TmpKRU9VVTJNVUU1TXpNaU93b0pJbkJ5YjJSMVkzUXRhV1FpSUQwZ0luZHlZV2x5ZEdWemRHaGhjbTVsYzNNdWRHVnpkRjh5SWpzS0NTSnBkR1Z0TFdsa0lpQTlJQ0kyTXpVM01ERXhOalVpT3dvSkltSnBaQ0lnUFNBaVkyOXRMbmRwWkdkbGRISmxkbTlzZEM1MFpYTjBhR0Z5Ym1WemN5NWtaV0oxWnlJN0Nna2ljSFZ5WTJoaGMyVXRaR0YwWlMxdGN5SWdQU0FpTVRNMk9ETXhPVFkyTWpZM01DSTdDZ2tpY0hWeVkyaGhjMlV0WkdGMFpTSWdQU0FpTWpBeE15MHdOUzB4TWlBd01EbzBOem8wTWlCRmRHTXZSMDFVSWpzS0NTSndkWEpqYUdGelpTMWtZWFJsTFhCemRDSWdQU0FpTWpBeE15MHdOUzB4TVNBeE56bzBOem8wTWlCQmJXVnlhV05oTDB4dmMxOUJibWRsYkdWeklqc0tDU0p2Y21sbmFXNWhiQzF3ZFhKamFHRnpaUzFrWVhSbElpQTlJQ0l5TURFekxUQTFMVEV5SURBd09qUTNPalF5SUVWMFl5OUhUVlFpT3dwOSI7CgkiZW52aXJvbm1lbnQiID0gIlNhbmRib3giOwoJInBvZCIgPSAiMTAwIjsKCSJzaWduaW5nLXN0YXR1cyIgPSAiMCI7Cn0=";

var kResult_errOKRevalidated = "ok_revalidated";
var kResult_errIAPInvalid = "err_iap_invalid";
var kResult_errIAPTransactionSaveFailed = "err_iap_transaction_save_fail";  // this means the IAP worked but the transaction failed to save.  The client can err out or treat as ok

exports.validateIOSPurchase = function(req, res)
{
	// assert params
	if(!Utils.validateRequiredParams(req.body, ["receipt"], res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");

		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}

	var isProduction = true;
	var isDebug = true;

	var validator = new IOSIAPValidator(isProduction, isDebug, null);

	var receiptData = req.body["receipt"];
	LOGDEBUG("***************\n" + JSON.stringify(req.body));
	LOGDEBUG("**************************");


	

	validator.verifyReceipt(receiptData, function (isValid, errorMsg, verifyResult) {

		// translate to our standard format
		LOGINFO(util.format("Validated receipt - valid?:%s msg:%s", isValid ? "true" : "false", errorMsg));


		// return error if not valid
		if (!isValid)
		{
			var responseObj = Utils.formatResponse(kResult_errIAPInvalid, errorMsg, "");

			res.send(responseObj);

			return;
		}

		var transactionReceipt = verifyResult.receipt;

		LOGDEBUG("after validation");

		// get the database
		var appName = req.param("appname");
		var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
		if(!database)
		{
			LOGERROR("Could not find database");
			var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
			res.send(responseObject);

			return;
		}

		// make sure we have a valid product id.
		console.log(">>>" + transactionReceipt["product_id"]);
		var curPid = transactionReceipt["product_id"];

		// Change to new method
		// this is an attack vector on iOS.  Make sure the product_id exists and is active
		safeFindInventory(database, appName, curPid, function(err, result) {

			if(err || result == null)
			{
				LOGERROR("Someone may be trying to hack us.  Invalid product id");

				var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
				res.send(errResponse);

				return;
			}

			LOGDEBUG("afer find inventory");

			// is it active?
			var inventoryItem = result;
			if(inventoryItem["status"] != "active") {
				LOGERROR("Product id is valid but inactive");

				var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "inactive product id", "");
				res.send(errResponse);

				return;

			}

			// create a transaction record
			var price = req.body["price"] || "0";
			price = Number(price.replace(/[^0-9\.]+/g,""));// strip non numeric/dec
			LOGDEBUG("price is: " + price);

			// override the price with the price from the inventory
			if(inventoryItem["current_price"]) {
				price = inventoryItem["current_price"];
			}

			var transactionsTable = database.getTransactionCollection();
			var theTransaction = transactionsTable.createTransactionRecord(
				new Date(),
				req.body["uuid"],
				req.body["odin"],
				"ios",
				transactionReceipt["product_id"],
				transactionReceipt,
				price);


			// See if we have this (prevent replay attacks).  If so then we return a different response.  This
			// response is interpreted differently by the client based on whether this is a consumable purchase or not
			transactionsTable.findOne(theTransaction["user_uuid"], theTransaction["transaction_id"], function (err, resultObj) {


				// if found then we are done
				if (resultObj)
				{
					LOGINFO("already verified transaction id:" + theTransaction["transaction_id"]);

					var dataResponse = {
						"uuid":req.body["uuid"],
						"date": new Date(),
						"platform":"ios",
						"transaction_id": theTransaction["transaction_id"]
					};
					var responseObj = Utils.formatResponse(kResult_errOKRevalidated, "", dataResponse);
					res.send(responseObj);

					return;
				}

				// save it
				transactionsTable.insertTransaction(theTransaction, function (err, result) {

					LOGINFO("save transaction result:" + err);

					//TODO: we want some kind of notification alarm if this happens, but we want to continue ok
					var responseObj = {};
					if (err) {
						responseObj = Utils.formatResponse(kResult_errIAPTransactionSaveFailed, "Transaction didnt save", "");
						LOGCRITICAL("Transaction didnt save: ");
					}
					else {
						var dataResponse = {
							"uuid":req.body["uuid"],
							"date": new Date(),
							"platform":"ios",
							"transaction_id": theTransaction["transaction_id"]
						};
						responseObj = Utils.formatResponse(Utils.ERR_OK, "", dataResponse);
					}

					res.send(responseObj);

				}); // saveTransaction()

			}); // findTransaction()

		});//inventory.findOne()

	}); // verifyReceipt
};
//-------------------------------------------------------------
/*
{"orderId":"12999763169054705758.1321922044628689","packageName":"com.widgetrevolt.timewinder","productId":"com.widgetrevolt.timewinder.test_managed","purchaseTime":1382232238000,"purchaseState":0,"purchaseToken":"izbzbhfqfarlqqcgiellvgdh.AO-J1Ox1SRwQmvZU9OXrf2h35KkmSvi1zRbINgKYEceUuEZvL1ctK3dXV4kBNGGUrV445tR-lbXOuMfcUfBDnkGbisl5mZdt1RbnGmhDrWTFi1YoeClz5UP0Q8bWzT77XyEtmb-li_0Ei0FeSJhZVcg4c5mhHrj661pYWfozVgf6bTUT6R52d2A"}


Su3axTm6VbXR//HmgtfF0iq1177Wy+bzG6r3n7qjLfsjbZUGlHuJzTxA2vvbvOQmGWoFnP8GtaJn7L4KDrH1hmdMOJIfowr+HZavGjBJY/DdFbVyRqcj8eto28FEg6xJy5VgF3dfyeRYtbBLX+brFjRN2fl4yXbR65iCEfR2wevVIaB/uQ7eU5YpeEN+72Cyi3ijaravf1sSEY+EwLbgUMhsAJmUR1k4ufgXrPrIdAmvBgYDMA355XUZn/YOd4LDFwJQBgONhanhf36aGid2QXhKcTOi2gm1ZItNDSwQEl4THuMRxc/QrCwqU63Ggh0+6sxEPpszt7FOvFrx0xWo1g==

*/
//TODO: merge this and iOS validator.  Check for valid product id up front.  Do s2s verification last
exports.validateAndroidPurchase = function(req, res)
{
	// assert params
	if(!Utils.validateRequiredParams(req.body, ["purchase_data", "signature"], res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");

		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}

	var purchaseData = req.body["purchase_data"];
	var signature = req.body["signature"];
	var appName = req.param("appname");
	LOGDEBUG(purchaseData);
	LOGDEBUG(signature);

	var validator = AndroidValidator.createInstance(appName);
	validator.verifyReceipt(purchaseData,  signature,  function (isValid, errCode, errorMsg) {

		// translate to our standard format
		LOGINFO(util.format("And Validated receipt - valid?:%s msg:%s", isValid ? "true" : "false", errorMsg));


		// return error if not valid
		if (!isValid)
		{
			var responseObj = Utils.formatResponse(kResult_errIAPInvalid, errorMsg, "");
			res.send(responseObj);
			return;
		}

		// translate the purchase data into an object
		var purchaseObj = null;
		try {
			purchaseObj = JSON.parse(purchaseData);
		}
		catch(e) {

			LOGERROR(new Error().stack);
			purchaseObj = null;
		}

		if(purchaseObj == null)
		{
			LOGERROR("Error parsing purchaseObj");
			var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error parsing purchaseObj", "");
			res.send(responseObject);
			return;//EXIT
		}

		// get the database
		var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
		if(!database)
		{
			LOGERROR("Could not find database");
			var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
			res.send(responseObject);

			return;
		}


		// see if this is an actual inventory item
		var curPid = purchaseObj["productId"];
		safeFindInventory(database, appName, curPid, function(err, result) {
			if(err || !result)
			{
				LOGERROR("Error finding android product id:" + purchaseObj["productId"]);
				var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error validating - 345", "");
				res.send(responseObject);
				return;//EXIT
			}

			var inventoryItem = result;
			if(inventoryItem["status"] != "active") {
				LOGERROR("inactive inventory item");

				var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "inactive product id", "");
				res.send(errResponse);

				return;//EXIT
			}

			// create a transaction record
			var transactionReceipt = purchaseObj;
			transactionReceipt.purchaseToken = "";	//empty out the purchase token before saving to db

			var price = req.body["price"] || "0";
			price = Number(price.replace(/[^0-9\.]+/g,""));

			// override the price with the price from the inventory
			if(inventoryItem["current_price"]) {
				price = inventoryItem["current_price"];
			}

			LOGDEBUG("price is: " + price);

			var transactionsTable = database.getTransactionCollection();
			var theTransaction = transactionsTable.createTransactionRecord(
				new Date(),
				req.body["uuid"],
				"",
				"android",
				purchaseObj["productId"],
				transactionReceipt,
				price);



			// See if we have this (prevent replay attacks).  If so then we return a different response.  This
			// response is interpreted differently by the client based on whether this is a consumable purchase or not
			transactionsTable.findOne(theTransaction["user_uuid"], theTransaction["transaction_id"], function (err, resultObj) {


				// create a clean transaction response without the transaction receipt
				var dataResponse =  JSON.parse(JSON.stringify(theTransaction));
				dataResponse["itms_receipt"] = ""; 

				// if found then we are done
				if (resultObj)
				{
					LOGINFO("already verified transaction id:" + theTransaction["transaction_id"]);

					var responseObj = Utils.formatResponse(kResult_errOKRevalidated, "", dataResponse);
					res.send(responseObj);

					return;
				}

				// save it
				transactionsTable.insertTransaction(theTransaction, function (err, result) {

					LOGINFO("save transaction result:" + err);

					//TODO: we want some kind of notification alarm if this happens, but we want to continue ok
					var responseObj = {};
					if (err) {
						responseObj = Utils.formatResponse(kResult_errIAPTransactionSaveFailed, "Transaction didnt save", "");
					}
					else {
						responseObj = Utils.formatResponse(Utils.ERR_OK, "", dataResponse);
					}

					res.send(responseObj);

				}); // saveTransaction()

			}); // findTransaction()

		});//findOne()




	}); //verifyReceipt()
};

function safeFindInventory(database, appname, curPid, callback)
{

	var inventoryDb = database.getInventoryCollection();
	inventoryDb.findOne(curPid, function(err, result) {
		callback(err, result);
	})
}


//-------------------------------------------------------------
exports.getInventory = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");
		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}

	var appName = req.param("appname");

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		LOGERROR("Could not find database");
		var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
		res.send(responseObject);

		return;
	}

	var inventoryDb = database.getInventoryCollection();

	inventoryDb.getActiveInventoryJSON(function(err, result) {
		var responseObject = {};
		if (err) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error getting inventory", "");
		}
		else {
			// shove this into an "items" field for consistency
			var data = {};
			data["items"] = result;

			responseObject = Utils.formatResponse("ok", "", data);
		}

		res.send(responseObject);
	});
};

//-------------------------------------------------------------
// /register_device
exports.registerDevice = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",

		"device_id",
		"apns_token",
		"language",
		"country",

		"time_zone",
		"platform",
		"osvers",
		"device",
		"carrier",

		"mcc",
		"mnc",
		"imei"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var devicesDb = database.getDevicesCollection();

	var params = req.body;
	var deviceObj = null;
	try {
		deviceObj = devicesDb.createDeviceObject(
			params["uuid"],
			params["device_id"],
			params["apns_token"],
			params["language"],
			params["country"],

			params["time_zone"],
			params["platform"],
			params["osvers"],
			params["device"],
			params["carrier"],

			params["mcc"],
			params["mnc"],
			params["imei"],

			params["apid"],
			params["push_tags"],
			params["push_disabled"]
		);
	}
	catch(e) {
		deviceObj = null;
	}

	if(!deviceObj) {
		sendError(res, Utils.ERR_GENERAL, "error creating device object");
		return;
	}

	devicesDb.saveDeviceObject(deviceObj, function(err, result) {
		var responseObject = {};
		if (err) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving device info", "");
		}
		else {
			var data = {};
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	});//saveDeviceObject()


};

//--------------------------------------------------
exports.redeemCoupon = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"coupon_code",
		"tickcount"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		LOGERROR("Invalid hash/auth pair or app");
		var errResponse = Utils.formatResponse(Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app", "");
		res.send(errResponse);

		return;
	}


	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		LOGERROR("Could not find database");
		var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error loading db/collection", "");
		res.send(responseObject);

		return;
	}

	var couponsDb = database.getCouponsCollection();

	var uuid = req.param("uuid");
	var couponCode = req.param("coupon_code");
	var tickcount = req.param("tickcount");

	// redeem it
	couponsDb.redeemCoupon(uuid, couponCode, tickcount, function(err, result) {

		if(err) {

			var errStr = "coupon redemption error: " + err;
			LOGERROR(errStr);
			var responseObject = Utils.formatResponse(Utils.ERR_GENERAL, errStr, "");
			res.send(responseObject);

			return;
		}

		// ok - the result should be a hash of the tickcount
		var data = {};
		data["checksum"] = result;

		var responseObject = {};
		responseObject = Utils.formatResponse("ok", "", data);

		res.send(responseObject);

	});

};

//-------------------------------------------------------------
// /save_app_user_info
exports.saveAppUserInfo = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"document"

	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var clientUsersDb = database.getClientUsersCollection();

	var params = req.body;
	var cObj = null;
	try {
		var jsonStr = params["document"];
		var jsonObj = JSON.parse(jsonStr);
		cObj = clientUsersDb.createClientUserObj(
			params["uuid"],
			jsonObj
		);
	}
	catch(e) {
		cObj = null;
	}

	if(!cObj) {
		sendError(res, Utils.ERR_GENERAL, "error creating client users object");
		return;
	}

	clientUsersDb.saveClientUserObject(cObj, function(err, result) {
		var responseObject = {};
		if (err) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving client user info", "");
		}
		else {
			var data = {};
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	});//saveDeviceObject()


};
//-------------------------------------------------------------
exports.getAppUserInfo = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid uuid/auth/app");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var params = req.body;
	var uuid = params["uuid"];
	var clientUsersDb = database.getClientUsersCollection();
	clientUsersDb.findOne(uuid, function(err, result) {

		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving client user info", "");
		}
		else {
			var data = {};
			data["client_user"] = result["document"];
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);

	});//findOne

};

//-------------------------------------------------------------
exports.reportScore = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"app_id",
		"leaderboard_id",
		"score"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var params = req.body;
	var appName = req.param("appname");
	var appId = params["app_id"];
	var userUUID = params["uuid"];
	var leaderboardId = params["leaderboard_id"];
	var score = parseInt(params["score"]);


	var leaderboardDb = database.getLeaderboardCollection();
	leaderboardDb.reportScore(appName, appId, leaderboardId, userUUID, score, function(err, result) {

		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving client user info", "");
		}
		else {
			var data = {};
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	} );//reportScore()



};

//-------------------------------------------------------------
exports.getGlobalLeaders = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"app_id"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var params = req.body;
	var appId = params["app_id"];


	var leaderboardDb = database.getLeaderboardCollection();
	leaderboardDb.getGlobalLeaders(appId, function(err, result) {

		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving client user info", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	} );//reportScore()



};

//-------------------------------------------------------------
exports.getFriendLeaders = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"app_id",
		"leaderboard_id",
		"fb_list",
		"gk_list"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var params = req.body;
	var appId = params["app_id"];
	var userUUID = params["uuid"];
	var leaderboardId = params["leaderboard_id"];
	var facebookFriendList = params["fb_list"];
	var gamekitFriendList = params["gk_list"];


	var leaderboardDb = database.getLeaderboardCollection();
	leaderboardDb.getFriendLeaders(appId, userUUID, leaderboardId, facebookFriendList, gamekitFriendList, function(err, result) {

		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error saving client user info", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	} );//reportScore()



};

//-------------------------------------------------------------
exports.getPromoBanners = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}

	// create a record to save
	var params = req.body;


	var promoBannerDb = database.getPromoBannersCollection();
	promoBannerDb.getActivePromoJSON(function(err, result) {

		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error getting promo info", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);

	});//getActivePromoJSON()


};

//-------------------------------------------------------------
exports.sendFacebookGift = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"user_social_id",
		"fb_id_list",
		"request_type",
		"fname",
		"lname"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}


	var params = req.body;

	var userUUID = params["uuid"];
	var facebookFriendList = params["fb_id_list"];
	var userSocialId = params["user_social_id"];
	var requestType = params["request_type"];
	var fname = params["fname"];
	var lname = params["lname"];

	//NOTE: we could verify the user here, but the worst that can happen is we just get bogus gifts
	var socialDb = database.getSocialActionsCollection();
	socialDb.sendGifts(userUUID, userSocialId, facebookFriendList, requestType, fname, lname, function(err, result) {
		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error sending gifts", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	});

};
//-------------------------------------------------------------
exports.getAvailableGifts = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"user_social_id"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}


	var params = req.body;

	var userSocialId = params["user_social_id"];

	//NOTE: we could verify the user here, but the worst that can happen is we just get bogus gifts
	var socialDb = database.getSocialActionsCollection();
	socialDb.getGiftsForSocialId(userSocialId, 100, function(err, result) {
		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error getting gifts", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	});

};

//-------------------------------------------------------------
// request_type can be "all" or "" to claim all social actions for user
exports.claimFacebookGifts = function(req, res)
{
	// check for our required params
	var reqParams = [
		"uuid",
		"auth",
		"user_social_id",
		"request_type"
	];

	if(!Utils.validateRequiredParams(req.body, reqParams, res)) {
		return;
	}

	// make sure we have a valid source
	if (!isValidSource(req))
	{
		sendError(res, Utils.ERR_INVALID_PARAM, "invalid params");
		return;
	}

	// get our data object
	var database = DatabaseManager.sharedManager().getDBForApp(req.param("appname"));
	if(!database)
	{
		sendError(res, Utils.ERR_GENERAL, "cannot find database collection");
		return;
	}


	var params = req.body;

	var userSocialId = params["user_social_id"];
	var requestType = params["request_type"];

	//NOTE: we could verify the user here, but the worst that can happen is we just get bogus gifts
	var socialDb = database.getSocialActionsCollection();
	socialDb.claimGiftsForSocialId(userSocialId, requestType, function(err, result) {
		var responseObject = {};
		if (err || !result) {
			responseObject = Utils.formatResponse(Utils.ERR_GENERAL, "error getting gifts", "");
		}
		else {
			var data = result;
			responseObject = Utils.formatResponse("ok", "", data);
		}
		res.send(responseObject);
	});

};


//-------------------------------------------------------------
exports.tapstreamPostback = function(req, res)
{
	
};

///////////////////////////////////////////////////////
// Private methods

///////////////////////////////////////////////////////

//-------------------------------------------------------------
// utility for sending an error
function sendError(res, inErrType, inErrStr)
{
	LOGERROR(inErrStr);
	var responseObject = Utils.formatResponse(inErrType, inErrStr, "");
	res.send(responseObject);

}

// Private utils
function LOGINFO(s) {
	Logger.info("API", s);
}
function LOGDEBUG(s) {
	Logger.debug("API", s);
}
function LOGERROR(s) {
	Logger.error("API", s, false);
}
function LOGCRITICAL(s) {
	Logger.error("API", s, true);
}

//----------------------------------------------
function isValidSource(req)
{
	var params = req.body;

	// valid app


	var appName = req.param("appname");
	//console.log("***************** appname=" + appName);
	if(!APP_CONFIG.hasOwnProperty(appName)) {
		return false;
	}



	// validate uuid/auth
	if (!params.hasOwnProperty("uuid")) {
		return false;
	}

	if (!params.hasOwnProperty("auth")) {
		return false;
	}

	var uuid = params["uuid"];
	var authHash = params["auth"];

	if (uuid == "" || authHash == "") {
		return false;
	}

	var sha256 = crypto.createHash('sha256');

	var hashKey = kUUIDHashSalt + uuid + kUUIDHashSalt;
	var myHashResult = sha256.update(hashKey, "utf8").digest("hex");

	if (options.DEBUG) {
		LOGDEBUG(">>> isValidAuth - submitted:" + authHash + ", my result:" + myHashResult);
	}


	if (authHash != myHashResult) {
		LOGERROR("User not authorized:\n...." + authHash + "\n...." + myHashResult);
		return false;
	}

	return true;
}
