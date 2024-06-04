////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

authenticate(function(user){
    // LOGGED IN

}, function(){
    // NOT LOGGED IN
    location.href = "/login";
}, function(error) {
    // ERROR
    if (error.code === "auth/network-request-failed") {
        handleError("[HOME] Error Authenticating", error);
    }
    
    location.href = "/login";
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ON LOAD
////////////////////////////////////////////////
////////////////////////////////////////////////

var userEmail = "";

try {
    userEmail = localStorage.getItem("email");
    if (userEmail.includes("users.crypt.ee")) { userEmail = ""; }
} catch (error) {}

// set email
$("#billing-email").val(userEmail);

if (userEmail) {
    // hide input
    $("#billing-email").addClass("already-have"); 
    
    // hide its error messages
    $("#billing-email").next().html("");
}

// set current plan
if (theUserPlan && theUserPlan !== "free") {
    if (storagePlansByID[theUserPlan]) {
        var currentPlan = storagePlansByID[theUserPlan];
        var currentPeriod = currentPlan.period;
        var currentPlanSize = currentPlan.formattedQuota.replace(" ", "");
        $(`.plan[plan='${currentPlanSize}']`).attr("current", currentPeriod);
        $('body').attr("current", theUserPlan);

        if (thePaymentProcessor === "paddle" && storagePlansByID[theUserPlan].period === "yr") {
            yearlyPaddle();
        }
    }
}

function yearlyPaddle() {
    $("button[period='yr']").trigger("click");
    $("body").addClass("paddle-yearly");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 PERIOD SELECTION
////////////////////////////////////////////////
////////////////////////////////////////////////



$('#period').on('click', 'button', function (event) {
    $('#period > button').removeClass("active");
    $(this).addClass("active");
    var period = $(this).attr("period");
    $('#period').attr("period", period);

    $("#period-toggle")[0].checked = (period === "mo");
});

$("#period-toggle").on('click', function(event) {
    
    var isMonthly = $("#period-toggle")[0].checked;

    var period = "";
    if (isMonthly) {
        period = "mo";
    } else {
        period = "yr";
    }
    
    $('#period > button').removeClass("active");
    $("#period > button[period='"+period+"']").addClass("active");
    $('#period').attr("period", period);
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	PLAN SELECTION
////////////////////////////////////////////////
////////////////////////////////////////////////

$('.plan').on('click', "button", function (event) {
    var plan = $(this).parents(".plan").attr("plan");
    var period = $("#period").attr("period");
    var price = $(this).attr(period);

    if (theUserPlan && theUserPlan !== "free" && theUserPlan !== "gift") {
        switchConfirm(plan, period);
    } else {
        chosenPlan(plan, period, price);
    }
});


function chosenPlan(plan, period, price) {
    $("#billing").attr({ "plan": plan, "period": period, "price": price });

    $("#chosenstorage > .storage").html(plan.replace("GB", ""));
    $("#chosenbilling").attr("price", price);
    $("#chosenbilling").attr("period", period);

    if (usingPromoCode) {
        var discountedPrice = (price - (price * (usingPercentOff / 100))).toFixed(2);
        $("#chosenbilling").attr("price", discountedPrice);
    }

    $("body").removeClass("chooseplan");
    $("body").addClass("billing");
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHECK PROMO / COUPON CODE
////////////////////////////////////////////////
////////////////////////////////////////////////

var usingPromoCode;
var usingPercentOff;

/**
 * Applies a given promo code to checkout, optionally using the provided coupon code and percentage. 
 * Information like percentage etc passed through this is validated again on the server side, so this is just for UI / cosmetic purposes. 
 * We'd like to kindly save you –the hacker, reading this– some time, and spare your servers, our servers and stripe's servers the trouble.
 * World's on fire, why waste energy making unnecessary requests to servers here and there right?
 * Then again, if you're reading this, and your first thought was "oh lemme see if I can hack this", maybe shoot us an email?
 * We could use more like-minded people like you on our team!
 * @param {string} [couponCode] 
 * @param {number} [percentOff] 
 */
async function applyPromoCode(couponCode, percentOff) {
    breadcrumb('[PROMO CODE] Applying Promo Code');
    
    couponCode = couponCode || '';
    if (couponCode) { $("#coupon-input").val(couponCode); }
    couponCode = ($("#coupon-input").val() || "").trim().toUpperCase();
    percentOff = percentOff || await checkPromoCode(couponCode);

    if (percentOff > 0) { 
        breadcrumb('[PROMO CODE] Applied Promo Code: ' + couponCode + ' [' + percentOff + "% OFF]");
        usingPromoCode = couponCode;
        usingPercentOff = percentOff;
        $("#discount-tag").text('–' + percentOff + "%");
        $("body").attr("discount", percentOff);
    } else {
        breadcrumb('[PROMO CODE] No promo code provided / invalid promo code provided, wont apply promo code');
        removePromoCode();
    }
}

function removePromoCode() {
    usingPromoCode = null;
    usingPercentOff = 0;
    $("#coupon-input").val("");
    $("#discount-tag").text("");
    $("body").removeAttr("discount");
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 BILLING INFORMATION SECTION 
////////////////////////////////////////////////
////////////////////////////////////////////////

function validateBillingInfo() {
    
    var name    = $("#billing-name").val().trim();
    var email   = $("#billing-email").val().trim();
    var country = $("#countries").val().trim();
    var zip     = $("#billing-zip").val().trim();

    var billingInfoComplete = true;
    
    if (euCountryCodesList.includes(country)) { 
        // show vat
        $("#vat-number").show();
    } else {
        // hide vat
        $("#vat-number").hide();
    }

    if (!stripeValidation.num || !stripeValidation.exp || !stripeValidation.cvc) {
        $("#checkout-button").attr("disabled", true);
        billingInfoComplete = false;
        return false;
    }    

    if (!name) {
        if ($('#billing-name').hasClass("focused")) {
            $('#billing-name').addClass("error");
        }

        billingInfoComplete = false;
        $("#checkout-button").attr("disabled", true);
        return false;
    } else {
        $('#billing-name').removeClass("error");
    }

    if (!country || country === "XX") {
        $('#countries').addClass("error");
        billingInfoComplete = false;
        $("#checkout-button").attr("disabled", true);
        return false;
    } else {
        $('#countries').removeClass("error");
    }
    
    if (!zip) {
        if ($('#billing-zip').hasClass("focused")) {
            $('#billing-zip').addClass("error");
        }
        billingInfoComplete = false;
        $("#checkout-button").attr("disabled", true);
        return false;
    } else {
        $('#billing-zip').removeClass("error");
    }

    if ((!email) || (email && !isEmail(email))) {
        if ($('#billing-email').hasClass("focused")) {
            $('#billing-email').addClass("error");
        }
        billingInfoComplete = false;
        $("#checkout-button").attr("disabled", true);
        return false;
    } else {
        $('#billing-email').removeClass("error");
    }
    
    if (billingInfoComplete) {
        $("#checkout-button").removeAttr("disabled");
        return true;
    } else {
        $("#checkout-button").attr("disabled", true);
        return false;
    }

}

$("#countries").on('change', function (event) {
    setTimeout(validateBillingInfo, 20);
});

$("#billing-name").on('keydown keypress paste copy cut change', function (event) {
    setTimeout(validateBillingInfo, 20);
}); 

$("#billing-email").on('keydown keypress paste copy cut change', function (event) {
    setTimeout(validateBillingInfo, 20);
}); 

$("#billing-zip").on('keydown keypress paste copy cut change', function (event) {
    setTimeout(validateBillingInfo, 20);
}); 

$("#billing-name, #billing-email, #billing-zip").on('focus', function(event) {
    let input = $(this);
    setTimeout(function () {
        input.addClass("focused");
    }, 30);
}); 








////////////////////////////////////////////////
////////////////////////////////////////////////
//	VALIDATE VAT
////////////////////////////////////////////////
////////////////////////////////////////////////

var vatInfo = {};
var validatingVAT = false;
async function validateVAT() {

    validatingVAT = true;

    var vatNumber = $("#vat-number").val().trim();
    
    $("#company-name").html("validating vat #");
    $("#company-address").html("one moment please");
    $("#company").removeClass("validating validated error");
    $("#company").addClass("validating");

    var vatResponse = await checkVAT(vatNumber);

    // {
    //     "valid": true,
    //     "database": "ok",
    //     "format_valid": true,
    //     "query": "LUxxxxxxxx",
    //     "country_code": "LU",
    //     "vat_number": "xxxxxxxx",
    //     "company_name": "AMAZON EUROPE CORE S.A R.L.",
    //     "company_address": "5, RUE PLAETIS L-2338 LUXEMBOURG"
    // }       

    if (!vatResponse || isEmpty(vatResponse)) { 
        $("#company").removeClass("validating validated error");
        vatInfo = {};
        validatingVAT = false;
        return false;
    }

    if (vatResponse.database !== "ok") {
        err("Sadly, seems like European Union's VAT database servers aren't responding at the very moment. For tax compliance reasons, we cannot accept your VAT number unless it's verifed by EU's servers. We recommend trying again shortly. alternatively, you can continue the checkout without entering your VAT #, however <i>we won't be able to add your VAT # to invoices in the future.</i>", 
            "failed to validate validate vat #");
        return false;
    }

    if (!vatResponse.valid || !vatResponse.format_valid) {
        err("Seems like your VAT # isn't valid, you've made a formatting mistake, or we don't support VAT-billing for your country. Please double check and try again. For tax compliance, we can't accept your VAT # unless it's verifed by EU's servers. Alternatively, you can continue the checkout without entering your VAT #, however <i>we won't be able to add your VAT # to invoices in the future.</i>", 
        "invalid vat #");
        return false;
    }

    $("#company").removeClass("validating validated error");
    $("#company").addClass("validated");
    $("#company-name").text(vatResponse.company_name);
    $("#company-address").text(vatResponse.company_address);
    
    vatInfo = vatResponse;
    validatingVAT = false;
    return true;

    function err(popupMsg, miniMsg) {
        createPopup(popupMsg, "error");
        $("#company").removeClass("validating validated error");
        $("#company").addClass("error");
        $("#company-name").text("error");
        $("#company-address").text(miniMsg);
        vatInfo = {};
        validatingVAT = false;
    }
}


function stripeNotLoaded(error) {
    createPopup("It seems that your browser / content blocker / dns filter is blocking <b>Stripe</b>, our payments processor from Ireland, Europe.<br><br>Please try disabling your ad blockers or dns filters if you have any, and try again.", "error");
    handleError("[PLANS] Stripe js lib not loaded/blocked. Showed error to user.", error, "warning");
    $("button.capacity").addClass("nostripe"); // disable capacity buttons
}




////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 CHECKOUT & STRIPE
////////////////////////////////////////////////
////////////////////////////////////////////////



var placeholderColor = "#888";
if (isFirefox) { placeholderColor = "#aaa"; }

var stripe;
try {
    stripe = Stripe('pk_live_D9FkoKTyS1dPXaHhGrMZM8be00VxCQFFx5', { apiVersion: '2020-08-27;tax_product_beta=v1', betas: ["tax_product_beta_1"] });
} catch (e) {
    stripeNotLoaded(e);
}

var elements = stripe.elements({fonts : [ { src: `url('https://static.crypt.ee/fonts/JosefinSans-VariableFont_wght.ttf')`, family: 'Josefin Sans' } ]});

var elementStyles = {
    base: {
        color: '#000',
        fontWeight: '350',
        fontFamily: 'Josefin Sans, sans-serif',
        fontSize: '16px',
        textTransform: 'lowercase',
        fontSmoothing: 'antialiased',
        textAlign: 'left',
        height: '48px',
        lineHeight: '50px',
        ':focus': { color: '#000' },
        '::placeholder': { color: placeholderColor },
        ':focus::placeholder': { color: placeholderColor },
    },
    invalid: {
        color: '#CC0101',
        ':focus': { color: '#000' },
        '::placeholder': { color: '#980000' }, 
    },
};

var elementClasses = { focus: 'focus', empty: 'empty', invalid: 'invalid' };

var cardNumber = elements.create('cardNumber', { style: elementStyles, classes: elementClasses });
cardNumber.mount('#card-pan');

var cardExpiry = elements.create('cardExpiry', { style: elementStyles, classes: elementClasses });
cardExpiry.mount('#card-exp');

var cardCvc = elements.create('cardCvc', { style: elementStyles, classes: elementClasses });
cardCvc.mount('#card-cvc');

var stripeValidation = { num : false, exp : false, cvc : false };

cardNumber.on('change', function(event) {
    if (event.error) {
        stripeValidation.num = false;
    } else {
        stripeValidation.num = true;
    }
    validateBillingInfo();
});

cardExpiry.on('change', function(event) {
    if (event.error) {
        stripeValidation.exp = false;
    } else {
        stripeValidation.exp = true;
    }
    validateBillingInfo();
});

cardCvc.on('change', function(event) {
    if (event.error) {
        stripeValidation.cvc = false;
    } else {
        stripeValidation.cvc = true;
    }
    validateBillingInfo();
});

async function createPaymentMethod(billingDetails) {
    
    var paymentMethodResult;
    try {
        paymentMethodResult = await stripe.createPaymentMethod({
            type: 'card',
            card: cardNumber,
            billing_details: billingDetails,
        });
    } catch (error) {
        handleError("[UPGRADE] Failed to create payment method", error);
        return false;
    }

    if (!paymentMethodResult || isEmpty(paymentMethodResult)) {
        handleError("[UPGRADE] Failed to create payment method, got no payment method result");
        return false;
    }
    
    var paymentMethod = paymentMethodResult.paymentMethod;

    if (!paymentMethod || isEmpty(paymentMethod)) {
        handleError("[UPGRADE] Failed to create payment method, stripe returned no payment method");
        return false;
    }

    return paymentMethod;

}






var paymentMethodID;
var paymentIntentSecret;

async function upgrade() {
    
    // VALIDATE THE FORM / AND DON'T CONTINUE IF IT'S NOT READY YET
    var formValidated = validateBillingInfo(); // true for checkout
    if (!formValidated) { return false; }

    // CHECK IF WE'RE STILL VALIDATING THE VAT – AND ABORT IF WE ARE.
    if (validatingVAT) { 
        createPopup("One moment please, we're still validating the VAT number you've entered.", "info");
        return false; 
    }

    // VALIDATION COMPLETE. START PROCESSING
    $("body").addClass("processing");

    // COLLECT EVERYTHING FROM INPUTS & FORM
    
    // GET PLAN DETAILS
    var plan = $("#billing").attr("plan") || "";
    var period = $("#billing").attr("period") || "";
    var storagePlan = storagePlans[period][plan];

    // GET INFO FROM FORM
    var zip = $("#billing-zip").val().trim();
    var name = $("#billing-name").val().trim();
    var email = $("#billing-email").val().trim();
    var country = $("#countries").val();
        



    // STEP 1 – COLLECT PAYMENT METHOD INFO
    var paymentInfo = { 
        email : email, 
        name : name, 
        address : { postal_code : zip } 
    };
    
    


    // STEP 2 – CREATE PAYMENT METHOD 
    var paymentMethod;
    try {
        paymentMethod = await createPaymentMethod(paymentInfo); // this is the only piece of info we'll send
    } catch (error) {
        handleError("[UPGRADE] Failed to create payment method", error);
    }

    if (!paymentMethod) {
        handleError("[UPGRADE] Failed to create payment method");
        processingError("failed-to-create-payment-method");
        return false;
    }

    paymentMethodID = paymentMethod.id;

    breadcrumb('[UPGRADE] Created payment method');




    // STEP 3 
    // NOW THAT WE'VE CREATED A PAYMENT METHOD. 
    // LET'S CREATE A CUSTOMER, AND ADD THEIR PAYMENT METHOD & INFO FOR INVOICES
    
    var customerDetails = { 
        email : email, 
        name : name,
        address : {} 
    };
    


    // IF IT'S A BUSINESS CHECKOUT (WITH VAT NUMBER) = CUSTOMER IS A BUSINESS
    var vatNumber;
    if (!isEmpty(vatInfo)) {
        
        // USE THE COMPANY NAME FOR INVOICE INSTEAD OFCARD HOLDER NAME
        customerDetails.name = vatInfo.company_name;
        
        // ADD BUSINESS COUNTRY FOR INVOICE, 
        customerDetails.address.country = vatInfo.country_code || country; 
        
        // ADD BUSINESS ADDRESS FOR INVOICE
        customerDetails.address.line1 = vatInfo.company_address; 

        // ADD BUSINESS VAT NUMBER FOR INVOICE
        vatNumber = vatInfo.query;

        breadcrumb('[UPGRADE] GOT Vat # – B2B User.');
    } else {
        breadcrumb('[UPGRADE] Did not get vat # – B2C User.');
    }
    
    


    // STEP 4 – CALL CHECKOUT API TO CREATE CUSTOMER, PROCESS TAX INFO, CREATE SUBSCRIPTION, AND RETURN A RESULT 
    
    var checkoutResponse = await checkout(paymentMethodID, customerDetails, storagePlan, vatNumber, usingPromoCode);
    if (!checkoutResponse) {
        processingError();
        return false;
    }

    // STEP 5 – SHOW ERRORS 

    // payment failed – had location issues
    if (checkoutResponse === "unrecognized_location") {
        processingError("unrecognized_location");
        return false;
    }

    // payment failed – stripe couldn't process payment
    if (checkoutResponse === "stripe-error") {
        processingError("stripe-error");
        return false;
    }

    // STEP 6 – CHECKOUT ALMOST COMPLETE. CHECK IF USER NEEDS TO DO A 3DS AUTH 

    var threeDSecureSuceeded = false;
    if (typeof checkoutResponse !== "string") {
        threeDSecureSuceeded = true;
    } else {
        if (checkoutResponse.startsWith("pi_") && checkoutResponse.includes("_secret_")) {
            // pi_abc_secret_xyz
            paymentIntentSecret = checkoutResponse;
            threeDSecureSuceeded = await show3DSPopup(paymentMethodID, paymentIntentSecret);
        } else {
            threeDSecureSuceeded = true;
        }
    }
    

    if (!threeDSecureSuceeded) {
        threeDSError();
        return false;
    }

    // payment succeeded, but had db issues
    if (checkoutResponse === "db-error") {
        dbError();
        return false;
    }

    // get new plan info from profile
    await getUserInfo();

    // show confirmation
    paymentSuccessful();
    return true;
}


function toggleVAT() {
    $("body").toggleClass("vat");
    if ($("body").hasClass("vat")) {
        $("#vat-fields > select").attr("tabindex", "");
        $("#vat-fields > input").attr("tabindex", "");
    } else {
        $("#vat-fields > select").attr("tabindex", "-1");
        $("#vat-fields > input").attr("tabindex", "-1");
    }
}


function paymentSuccessful() {
    breadcrumb("[UPGRADE] Checkout Successful!");
    $("body").removeClass("billing vat processing");
    $("body").addClass("thanks");
}

function threeDSError() {
    $("body").removeClass("billing vat processing threeds dberror");
    $("body").addClass("threeds");
}

function dbError() {
    $("body").removeClass("billing vat processing threeds dberror");
    $("body").addClass("dberror");
}

function processingError(type) {
    $("body").removeClass("processing threeds dberror"); 

    if (type === "unrecognized_location") {
        handleError("[UPGRADE] Unrecognized Location Error");
        createPopup("Looks like we're having difficulty determining your location for tax compliance purposes. Often this happens if you're using a VPN pointing to a different country than your payment card's issue country. Please temporarily turn off your VPN or TOR, then try again. thank you for your understanding.", "warning");
    } else {
        type = type || "";
        if (type) { type = "(" + type + ")"; }
        handleError(`[UPGRADE] Payment Processing Error ${type}`, {}, "fatal");
        createPopup("<strong>Failed to process your payment.</strong> Your card may be declined, or your ad-blocker may be blocking connections to Cryptee's payments processor <i>Stripe</i>. Please make sure you have enough funds on your card, double-check your payment information, unblock/allow connections to <i>Stripe</i> from your ad-blocker, check your internet connection and try again.", "error");
    }
}



/**
 * IF IT'S AN EU CARD / OR CARD REQUIRES 3DS, SHOW THE POPUP
 * @param {*} paymentMethodID 
 * @param {*} paymentIntentSecret i.e. "pi_abc_secret_xyz"
 */
async function show3DSPopup(paymentMethodID, paymentIntentSecret) {

    if (!paymentMethodID) { 
        handleError("[UPGRADE] Tried to show 3DS Popup, but there was no paymentMethodID");
        return false; 
    }

    if (!paymentIntentSecret) { 
        handleError("[UPGRADE] Tried to show 3DS Popup, but there was no paymentIntentSecret");
        return false; 
    }
    
    breadcrumb('[UPGRADE] Showing 3DS Auth Popup');
    var three3dsConfirmation = await stripe.confirmCardPayment(paymentIntentSecret, { payment_method:paymentMethodID });
    
    if (three3dsConfirmation.error) {
        // 3DS Failed. Try Again;
        handleError('[UPGRADE] 3DS Auth Failed! Will send email.', three3dsConfirmation.error, "fatal");
        return false;
    }
    
    breadcrumb('[UPGRADE] 3DS Auth Suceeded!');
    return true;
}

$('#card-info').on('click', function(event) {
    hidePopup("popup-card-info");
    createPopup("your payments will be processed securely and privately in ireland, europe, using stripe. your card information never touches cryptee's servers.", null, "card-info");
}); 




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SWITCH PLANS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function switchToPlan() {

    var planID = $("#switch-confirm").attr("planid");
    
    switchingPlans();

    var switchResponse = await switchPlans(planID);
    if (!switchResponse) {
        $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
        $("#switch-confirm").attr("planid", "");
        createPopup("Looks like we're having difficulty switching your plan. Chances are this is a connectivity issue. Your browser or ad-blocker may be blocking connections to our servers. Please check your internet connection, unblock connections to Cryptee from your ad-blocker and try again.", "error");
        return false;
    }

    // get new plan info from profile
    await getUserInfo();

    thanksSwitched();

    return true;

}

function switchConfirm(plan, period) {
    
    // set planid to confirmation modal
    var planID = storagePlans[period][plan];
    $("#switch-confirm").attr("planid", planID);

    // set plan name to button
    var planName = (plan + " plan").toLowerCase();
    $("#switchname").html(planName);

    // show confirmation modal
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("switch-confirm");

}

function closeSwitcher() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("#switch-confirm").attr("planid", "");
}

function switchingPlans() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("switching");
}

function thanksSwitched() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("thanks-switch");
}
