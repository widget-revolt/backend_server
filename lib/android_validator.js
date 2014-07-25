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


var crypto = require("crypto");


var Utils = require("./utils.js");
var Logger = require("../log.js").getLogger();

var APP_CONFIG = require("../config").APP_CONFIG;





///////////////////////////////////////////////////////
// Const

var kAlgorithm = "RSA-SHA1";

var AndroidIAPError = {};
	AndroidIAPError.eErr_ok = 0;
	AndroidIAPError.eErr_noPublicKey = -100;


///////////////////////////////////////////////////////
// Forward Exports
exports.createInstance = function(inAppName)
{
	var retObj = new AndroidIAPValidator(inAppName);
	return retObj;
}

exports.AndroidIAPError = AndroidIAPError;


///////////////////////////////////////////////////////
AndroidIAPValidator = function(inAppName)
{
	this._mPublicKey = "";


	if(!inAppName) {
		LOGCRITICAL("Invalid appname passed to Android validator constructor");
	}

	var publicKey = "";
	try
	{
		publicKey = APP_CONFIG[inAppName]["android_iap_hash"];
	}
	catch(e)
	{
		publicKey = "";
	}

	if(!publicKey) {
		LOGCRITICAL("Unable to retrieve public key for app: " + inAppName);
	}

	// format it
	this._mPublicKey = generateFormattedPublickey(publicKey);


	LOGDEBUG( "AndroidIAPValidator constructed");
};



//------------------------------------------------------
// public
AndroidIAPValidator.prototype.verifyReceipt = function(inPurchaseData, inSignature, callback)
{
	// based on code here: https://github.com/nothing2lose/node-InAppBilling/blob/master/lib/verifier.js
	// and here: https://github.com/ajones/iab_verifier
	if(this._mPublicKey == "") {
		LOGCRITICAL("Public key not initialized");
		callback(false, AndroidIAPError.eErr_noPublicKey, "no public key");
		return; // exit
	}

	var verifier = crypto.createVerify(kAlgorithm);
	verifier.update(inPurchaseData);
	var retVal = verifier.verify(this._mPublicKey,  inSignature,  'base64');

	LOGDEBUG("Android validation result:" + retVal);

	// execute callback
	callback(retVal,  AndroidIAPError.eErr_ok, "");


};

///////////////////////////////////////////////////////
// Private Util Methods

//------------------------------------------------------
function generateFormattedPublickey(publicKeyStr)
{
	var KEY_PREFIX, KEY_SUFFIX, chunkSize, chunks, str;

	KEY_PREFIX = "-----BEGIN PUBLIC KEY-----\n";
	KEY_SUFFIX = "\n-----END PUBLIC KEY-----";

	str = publicKeyStr;
	chunks = [];
	chunkSize = 64;
	while (str)
	{
		if (str.length < chunkSize)
		{
			chunks.push(str);
			break;
		}
		else
		{
			chunks.push(str.substr(0, chunkSize));
			str = str.substr(chunkSize);
		}
	}
	str = chunks.join("\n");
	str = KEY_PREFIX + str + KEY_SUFFIX;
	return str;
}


//------------------------------------------------------
function LOGINFO(s) {
	Logger.info("Android IAP Validator", s);
}
function LOGDEBUG(s) {
	Logger.debug("Android IAP Validator", s);
}
function LOGERROR(s) {
	Logger.error("Android IAP Validator", s, false);
}
function LOGCRITICAL(s) {
	Logger.error("Android IAP Validator", s, true);
}

