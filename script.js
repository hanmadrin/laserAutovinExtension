class ChromeStorage{
    constructor(name){
        if(typeof name!=='string') throw new Error ('unknown value for autoIncrement');
        this.name = name;
    }
    async GET() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(this.name, (result) => { resolve(result[this.name]); }); 
        }); 
    }
    async SET(db) {
        return new Promise((resolve, reject) => {
            const obj = {};
            obj[this.name]=db;
            chrome.storage.local.set(obj, function() {resolve(db)});
        });
    }
}
const mondayItemDB = new ChromeStorage('mondayItem');
// const mondayItemVinDB = new ChromeStorage('mondayItemVins');

const urls = {
    appraisal: 'https://www2.vauto.com/Va/Appraisal/Default.aspx',
}
const states = {
    near:[
        'Pennsylvania',
        'Maryland',
        'Delaware',
        'New Jersey',
        'New York',
        'Ohio'
    ],
    far:[
        'Maine',
        'Vermont',
        'New Hampshire',
        'Massachusetts',
        'Rhode Island',
        'Connecticut',
        'West Virginia',
        'Virginia',
        'North Carolina',
        'South Carolina',
        'Georgia',
        'Florida',
        'Alabama',
        'Mississippi',
        'Tennessee',
        'Kentucky',
        'Indiana',
        'Michigan',
        'Illinois',
        'Wisconsin',
        'Minnesota',
        'Iowa',
        'Missouri',
        'Texas',
        'Arkansas',
        'Oklahoma',
        'Kansas',
        'North Dakota',
    ]
};
const calculateCertificationCost = (state)=>{
    nearState = states.near.includes(state);
    farState = states.far.includes(state);
    if(nearState){
        return 800;
    }
    if(farState){
        return 1100;
    }
    return 800;
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const carfaxResults = async(vin,sellerPrice)=>{
    
    console.log('carfaxResults')
    let accidentCount = 0;
    let isTotalLoss = false;
    let structuralDamageCount = 0;
    let isAirbagDeployed = false;
    let isOdometerRollback = false;
    let brands = [];
    if((document.querySelector('#carfaxButton.x-carfax-problem') || document.querySelector('#carfaxButton.x-carfax-warning')) && sellerPrice>15000){
        console.log('warning or error sign on vauto');
        return {
            accidentCount:1,
            isTotalLoss,
            structuralDamageCount,
            isAirbagDeployed,
            isOdometerRollback,
            updateText:'Had warning or Error sign on Vauto For carfax',
        }
    }
    const carfax = await fetch(`https://www.carfaxonline.com/cfm/Display_Dealer_Report.cfm?partner=VAU_0&UID=D32338803&vin=${vin}`);
    const html = await carfax.text();
    var parser = new DOMParser();
    const carfaxDocument = parser.parseFromString(html, "text/html");
    const carfaxVin = carfaxDocument.querySelector('#headerVin,.sidebar-vehicle-information-vin,#vehicle-information-panel');
    if(carfaxVin==null){
        console.log('carfax is having issue for this vin');
        return null;
    }else{
        if(!carfaxVin.innerText.toLowerCase().includes(vin.toLowerCase())){
            console.log('carfax vin not found');
            return null;
        }
    }
    const additionalInfoTable = carfaxDocument.querySelector('#otherInformationTable,#additional-history-section');
    
    const totalLossInfo = additionalInfoTable.querySelector('#total-loss,tr:nth-child(2) td:first-child div').innerText;
    isTotalLoss = !totalLossInfo.toLowerCase().includes('no total loss reported');
    
    const structuralDamageInfo = additionalInfoTable.querySelector('#structural-damage,tr:nth-child(3) td:first-child div').innerText;
    const structuralDamageDates = structuralDamageInfo.match(/\d{2}\/\d{2}\/\d{4}/g)||[];
    structuralDamageCount = structuralDamageDates.length;
    
    const airbagDeploymentInfo = additionalInfoTable.querySelector('#airbag-deployment,tr:nth-child(4) td:first-child div').innerText;
    isAirbagDeployed = !airbagDeploymentInfo.toLowerCase().includes('no airbag deployment reported');

    const odometerRollbackInfo = additionalInfoTable.querySelector('#odometer-check,tr:nth-child(5) td:first-child div').innerText;
    isOdometerRollback = !odometerRollbackInfo.toLowerCase().includes('no indication of an odometer rollback');

    const accidentInfo = additionalInfoTable.querySelector('#accident-damage,tr:nth-child(6) td:first-child div').innerText;
    const accidentDates = accidentInfo.split('.').filter(a=>!a.includes('repairs')).join('.').match(/\d{2}\/\d{2}\/\d{4}/g)||[];
    accidentCount = accidentDates.filter(a=>!structuralDamageDates.includes(a)).length + structuralDamageCount;

    const updateText = (isTotalLoss?`Total Loss Reported`:'') + (structuralDamageCount>0?`\n${structuralDamageCount} Structural Damage Reported`:'') + (isAirbagDeployed?`\nAirbag Deployed`:'') + (isOdometerRollback?`\nInconsistent Mileage Indicated`:'') + (accidentCount>0?`\n${accidentCount} Accident Counted`:'');

    return {
        accidentCount,
        isTotalLoss,
        structuralDamageCount,
        isAirbagDeployed,
        isOdometerRollback,
        updateText
    }
};
const autocheckResults = async(vin)=>{
    let accidentCount = 0;
    let brands = [];
    const autocheck = await fetch(`https://www2.vauto.com/Va/Appraisal/ExperianReport.ashx?vin=${vin}`);
    const html = await autocheck.text();
    var parser = new DOMParser();
    const autocheckDocument = parser.parseFromString(html, "text/html");
    const autocheckVin = autocheckDocument.querySelector('.veh-info .rTableRow:first-child .rTableCell:not(.decodelabel )');
    if(autocheckVin==null){
      return null;
    }else{
        if(autocheckVin.innerText.toLowerCase() != vin.toLowerCase()){
            return null;
        }
    }
    const accidentImg = autocheckDocument.querySelector('[src="https://www.autocheck.com/reportservice/report/fullReport/img/accident-found.svg"]');
    if(accidentImg!=null){
        const accidentHolder = accidentImg.parentElement.parentElement;
        const accidentCountElement = accidentHolder.querySelector('.accident-count');
        accidentCount = parseInt(accidentCountElement.textContent);
    }
    const titleTableBody = autocheckDocument.querySelectorAll('.title-brand-table > .table_icon > .rTableRow');
    for(let i=0; i<titleTableBody.length; i++){
        if(titleTableBody[i].querySelector('img').getAttribute('src') !== 'https://www.autocheck.com/reportservice/report/fullReport/img/check-icon.svg'){
            brands.push(titleTableBody[i].querySelector(':scope>div.rTableCell:last-child').textContent);
        }
    }
    const damageTableBody = autocheckDocument.querySelectorAll('.problemCheckTable > .table_icon > .rTableRow');
    for(let i=0; i<damageTableBody.length; i++){
        if(damageTableBody[i].querySelector('img').getAttribute('src') !== 'https://www.autocheck.com/reportservice/report/fullReport/img/check-icon.svg'){
            brands.push(damageTableBody[i].querySelector(':scope>div.rTableCell:last-child').textContent);
        }
    }
    const otherTitleTableBody = autocheckDocument.querySelectorAll('.vehicleUseTable > .table_icon > .rTableRow');
    const otherTitleExceptions = ['Loan/Lien record(s)','Duplicate title record','Corrected title record'];
    for(let i=0; i<otherTitleTableBody.length; i++){
        if(otherTitleTableBody[i].querySelector('img').getAttribute('src') !== 'https://www.autocheck.com/reportservice/report/fullReport/img/check-icon.svg'){
            if(!otherTitleExceptions.includes(otherTitleTableBody[i].querySelector(':scope>div.rTableCell:last-child').textContent)){
                brands.push(otherTitleTableBody[i].querySelector(':scope>div.rTableCell:last-child').textContent);
            }
        }
    }
    
    // console.log(accidentCount, brands);
    return {accidentCount, brands};
};
const pageByUrl = ()=>{
    const url = window.location.href;
    if(url =='https://vauto.signin.coxautoinc.com/solutionlauncher'){
        return 'solutionLauncher';
    }
    if(url.indexOf('https://vauto.signin.coxautoinc.com/?solutionID=VAT_prod&clientId=')!=-1){
        return 'signIn';
    }
    if(url == 'https://www2.vauto.com/Va/Appraisal/Default.aspx'){
        return 'appraisal';
    }
    if(url.indexOf('https://www2.vauto.com/Va/Misc/Interstitial/UserInfoConfirmation.aspx'!=-1)){
        return 'confirmation';
    }
}
const simulateTextEntry = (input, text) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(input, text);
  
    const event = new Event('input', { bubbles: true });
    const change = new Event('change', { bubbles: true });
    const blur = new Event('blur', { bubbles: true });
    input.dispatchEvent(event);
    input.dispatchEvent(change);
    input.dispatchEvent(blur);
};
const simulateTextAreaEntry = (input, text) => {
    // const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    // nativeInputValueSetter.call(input, text);
    input.value = text;
    const event = new Event('input', { bubbles: true });
    const change = new Event('change', { bubbles: true });
    const blur = new Event('blur', { bubbles: true });
    input.dispatchEvent(event);
    input.dispatchEvent(change);
    input.dispatchEvent(blur);
};
const simulateMouseHover = (element) => {
    const event = new Event('mouseover', { bubbles: true });
    element.dispatchEvent(event);
};
const situationByContent = (page)=>{
    if(page=='appraisal'){
       return ''; 
    }
    if(page=='signIn'){
        const bridgeLinkButton = document.getElementById('bridgeLink');
        const username = document.getElementById('username');
        const signInButton = document.getElementById('signIn');
        if(username!=null && signInButton != null){
            return 'signInDefault';
        }
        if(bridgeLinkButton!=null){
            return 'signInBridge';
        }
        return 'signInUnknown';
    }
    if(page== 'confirmation'){
        return '';
    }
}
const autoChooseVehicleInformationInput = async(valueHolder)=>{
    for(let i=0;i<valueHolder.children.length;i++){
        const child = valueHolder.children[i];
        if(child.textContent!='' && child.textContent!= ' ' && child.textContent!= null){
            child.click();
            await sleep(3000);
            child.click();
            await sleep(2000);
            break;
        }
    }
}
const getEstDate = ()=>{
    const date = new Date();
    return date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: '2-digit',
        day: '2-digit'
    });
}
const dynamicAppraisal = async(info)=>{
    
    const vin = info.vin;
    const mileage = info.mileage;
    const state = info.state;
    const sellerPrice = parseInt(info.sellerPrice);
    const vehicle = info.vehicle;
    const series = info.series;
    const url = info.url;
    
    const vinInput = document.getElementById('Vin');
    const odometerInput = document.getElementById('Odometer');
    const yearInput = document.getElementById('ModelYear');
    const makeInput = document.getElementById('Make');
    const makeInputOptions = document.getElementById('ext-gen172');
    makeInput.values = makeInputOptions;
    const modelInput = document.getElementById('Model');
    const modelInputOptions = document.getElementById('ext-gen178');
    modelInput.values = modelInputOptions;
    const seriesInput = document.getElementById('Series');
    const seriesInputOptions = document.getElementById('ext-gen184');
    seriesInput.values = seriesInputOptions;
    const bodyTypeInput = document.getElementById('BodyType');
    const bodyTypeInputOptions = document.getElementById('ext-gen196');
    bodyTypeInput.values = bodyTypeInputOptions;
    const cylindersInput = document.getElementById('EngineCylinderCount');
    const cylindersInputOptions = document.getElementById('ext-gen208');
    cylindersInput.values = cylindersInputOptions;
    const transmissionInput = document.getElementById('TransmissionType');
    const transmissionInputOptions = document.getElementById('ext-gen220');
    transmissionInput.values = transmissionInputOptions;


    const inputSelectorOptions = [
        // seriesInput,
        bodyTypeInput,
        cylindersInput,
        transmissionInput
    ];
    
    const vehicleDescriptionInput = document.getElementById('VehicleDescription');
    
    console.log('inputting vin and mileage');
    const goButton = document.getElementById('VehicleApplyButton');
    simulateTextEntry(vinInput,vin);
    simulateTextEntry(odometerInput,mileage);
    await sleep(5000);
    console.log('Clicking go button');
    goButton.click();
    await sleep(5000);

    console.log('checking vin');
    const vinInputBorderColor = window.getComputedStyle(vinInput).getPropertyValue('border-color');
    if(vinInputBorderColor == 'rgb(204, 51, 0)'){
        return {
            'updates': 'VIN is not correct',
            'status': 'Invalid Vin'
        }
    }
    console.log('Ignoring if already appraised');
    const ignoreDuplicates = document.querySelectorAll('table[id].x-btn.v-btn-flat-primary.x-btn-noicon button');
    let ignoreDuplicate = null;
    for(let i=0;i<ignoreDuplicates.length;i++){
        const ignoreDuplicateButton = ignoreDuplicates[i];
        if(ignoreDuplicateButton.textContent.toLowerCase()=='ignore'){
            ignoreDuplicate = ignoreDuplicateButton;
            break;
        }
    }
    console.log(ignoreDuplicate);
    if(ignoreDuplicate!=null){
        ignoreDuplicate.click();
        await sleep(2000);
    }
    console.log('selecting series from vehicle');
   

    const vautoSeriesSeletionProcess = async () => {
        const inputHolder = seriesInput.values;
        const optionOpener = seriesInput.nextSibling;
        const seriesOptions = inputHolder.children;
        if(seriesInput.value=='' || seriesInput.value==null){
            for(let i=0;i<seriesOptions.length;i++){
                if(series==null) break;
                const seriesOption = seriesOptions[i];
                if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                    if(seriesOption.textContent.toLowerCase()==series.toLowerCase()){
                        const result =`Manually selected series using lead verifier provided series. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                }
            }
        }
        // vehicle title selection
        if(seriesInput.value=='' || seriesInput.value==null){
            for(let i=0;i<seriesOptions.length;i++){
                const seriesOption = seriesOptions[i];
                if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                    if(seriesOption.textContent.split(' ').length==1 && vehicle.toLowerCase().split((' ')).includes(seriesOption.textContent.toLowerCase())){
                        const result =`Manually selected series using Vehicle title. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                    if(seriesOption.textContent.split(' ').length>1 && vehicle.toLowerCase().match(new RegExp(seriesOption.textContent.toLowerCase().split(' ').join('|'),'gi'))){
                        const result =`Manually selected series using Vehicle title. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                }
            }
        }
        //exception rules
        if(seriesInput.value=='' || seriesInput.value==null){
            for(let i=0;i<seriesOptions.length;i++){
                const seriesOption = seriesOptions[i];
                if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                    //depends on vehicle title
                    if(vehicle.match(/(^)Ford.+(((F?:\s|-)(?:150|250|350|))|Maverick|Ranger|Lightening)/gi) && seriesOption.textContent.toLowerCase()=='xlt'){
                        const result =`Manually selected series using ford exception rule. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                    if(vehicle.match(/(^)Nissan/gi) && seriesOption.textContent.toLowerCase()=='sv'){
                        const result =`Manually selected series using nissan exception rule. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                    // depends on vauto values
                    if(makeInput.value="Jeep" && modelInput=="Grand Cherokee" && seriesOption.textContent.toLowerCase()=='laredo'){
                        const result =`Manually selected series using jeep exception rule. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                }
            }
            

        }
        if(seriesInput.value=='' || seriesInput.value==null){
            for(let i=0;i<seriesOptions.length;i++){
                const seriesOption = seriesOptions[i];
                if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                    if(true){
                        const result =`Manually selected the first vauto series option. Selected Series ${seriesOption.textContent}`;
                        optionOpener.click();
                        await sleep(5000);
                        seriesOption.click();
                        await sleep(5000);
                        return result;
                    }
                }
            }
        }
        return '';
    }

    const seriesSelectionText = await vautoSeriesSeletionProcess();
    console.log(seriesSelectionText);


    console.log('inputting unfilled vehicle information');
    for(let i=0;i<inputSelectorOptions.length;i++){
        if(inputSelectorOptions[i].value=='' || inputSelectorOptions[i].value==null){
            const inputHolder = inputSelectorOptions[i].values;
            for(let i=0;i<inputHolder.children.length;i++){
                const child = inputHolder.children[i];
                if(child.textContent!='' && child.textContent!= ' ' && child.textContent!= null){
                    child.click();
                    await sleep(3000);
                    child.click();
                    await sleep(2000);
                    break;
                }
            }
        }
    }

    console.log('click go button again');
    goButton.click();
    await sleep(5000);

    console.log('clicking on active radio button');
    const activeInput = document.getElementById('Active');
    activeInput.click();
    await sleep(5000);

    console.log('Unclicking series from provision-1');
    try{
        let provisionSeriesLists = document.querySelectorAll('#ext-gen371 h2.optionFieldLabel');
        for(let i=0;i<provisionSeriesLists.length;i++){
            if(provisionSeriesLists[i].textContent=='Series'){
                const seriesList = provisionSeriesLists[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
                for(let j=0;j<seriesList.length;j++){
                    seriesList[j].click();
                    await sleep(5000);
                    break;
                }
            }
        }
    }catch(e){
        console.log('Unclicking series from provision again-1');
        provisionSeriesLists = document.querySelectorAll('#ext-gen371 h2.optionFieldLabel');
        for(let i=0;i<provisionSeriesLists.length;i++){
            if(provisionSeriesLists[i].textContent=='Series'){
                const seriesList = provisionSeriesLists[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
                for(let j=0;j<seriesList.length;j++){
                    seriesList[j].click();
                    await sleep(5000);
                    break;
                }
            }
        }
    }

    console.log('Unclicking series from provision -2');
    try{
        let provisionSeriesLists = document.querySelectorAll('#ext-gen371 h2.optionFieldLabel');
        for(let i=0;i<provisionSeriesLists.length;i++){
            if(provisionSeriesLists[i].textContent=='Series'){
                const seriesList = provisionSeriesLists[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
                for(let j=0;j<seriesList.length;j++){
                    seriesList[j].click();
                    await sleep(5000);
                    break;
                }
            }
        }
    }catch(e){
        console.log('Unclicking series from provision again-2');
        provisionSeriesLists = document.querySelectorAll('#ext-gen371 h2.optionFieldLabel');
        for(let i=0;i<provisionSeriesLists.length;i++){
            if(provisionSeriesLists[i].textContent=='Series'){
                const seriesList = provisionSeriesLists[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
                for(let j=0;j<seriesList.length;j++){
                    seriesList[j].click();
                    await sleep(5000);
                    break;
                }
            }
        }
    }

    let provisionDistancePositionIndex = 5;
    console.log('setting suitable distance until year appears');
    for(let i=provisionDistancePositionIndex;i<15;i++,provisionDistancePositionIndex++){
        const provisionYearField = document.querySelector('#ext-gen369 td.selectedFields .titleRow');
        if(provisionYearField==null){
            const distanceInput = document.getElementById('distanceCombo');
            distanceInput.nextElementSibling.click();
            const listHolder = document.querySelector('.x-combo-list-inner[style="width: 68px; height: 300px;"]');
            const item = listHolder.children[i];
            item.click();
            await sleep(5000);
        }else{
            break;
        }
    }




    console.log('choosing year after and before of current');
    let provisionYearHoverField = document.querySelector('#ext-gen369 td.selectedFields .titleRow');
    simulateMouseHover(provisionYearHoverField);
    await sleep(5000);
    let provisionYearFields = document.querySelectorAll('.x-tip-bwrap .x-tip-mc .options ul li a');
    const beforeSelectedYear = provisionYearFields[1];
    beforeSelectedYear.click();
    await sleep(5000);
    provisionYearHoverField = document.querySelector('#ext-gen369 td.selectedFields .titleRow');
    simulateMouseHover(provisionYearHoverField);
    await sleep(5000);
    provisionYearFields = document.querySelectorAll('.x-tip-bwrap .x-tip-mc .options ul li a');
    const afterSelectedYear = provisionYearFields[3];
    afterSelectedYear.click();
    await sleep(5000);

    
    
    console.log('Setting suitable distance');
    for(let i=provisionDistancePositionIndex;i<15;i++){
        const provisionVehicleCount = document.querySelector('#ext-gen369 td.results tr.competitiveSetSize a');
        const vehicleCountValue = parseInt(provisionVehicleCount.textContent);
        if(vehicleCountValue<20){
            const distanceInput = document.getElementById('distanceCombo');
            distanceInput.nextElementSibling.click();
            await sleep(3000);
            const listHolder = document.querySelector('.x-combo-list-inner[style="width: 68px; height: 300px;"]');
            const item = listHolder.children[i];
            item.click();
            await sleep(5000);
        }else{
            break;
        }
    }

    console.log('clicking on jd condition: Rough');
    const jdConditions = document.querySelectorAll('#ext-gen418 ul.optionList li a');
    for(let i=0;i<jdConditions.length;i++){
        if(jdConditions[i].textContent=='Rough'){
            jdConditions[i].click();
            await sleep(5000);
            break;
        }
    }

    console.log('choosing jd series if not already chosen');
    const jdSeriesTitles = document.querySelectorAll('#ext-gen418 .optionField h2.optionFieldLabel');
    for(let i=0;i<jdSeriesTitles.length;i++){
        if(jdSeriesTitles[i].textContent=='Series'){
            const checkedSeriesList = jdSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedSeriesList.length==0){
                const seriesList = jdSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<seriesList.length;j++){
                    const seriesInputValue = document.getElementById('Series').value;
                    const seriesValue = seriesList[j].textContent;
                    const seriesPatternString = `${seriesInputValue.split(' ').join('|')}`;
                    const seriesPattern = new RegExp(seriesPatternString,'gi');
                    if(seriesPattern.test(seriesValue)){
                        seriesList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==seriesList.length-1){
                        seriesList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }
    



    console.log('opening kbb section');
    const kbbSectionOpener = document.querySelector('#ext-gen430');
    kbbSectionOpener.click();
    await sleep(5000);

    console.log('choosing kbb good condition');
    const kbbConditions = document.querySelectorAll('#ext-gen424 .optionField .options ul.optionList li a');
    for(let i=0;i<kbbConditions.length;i++){
        if(kbbConditions[i].textContent=='Very Good'){
            kbbConditions[i].click();
            await sleep(5000);
            break;
        }
    }
    
    console.log('choosing kbb trim if not already chosen');
    let kbbSeriesTitles = document.querySelectorAll('#ext-gen424 .optionField h2.optionFieldLabel');
    for(let i=0;i<kbbSeriesTitles.length;i++){
        if(kbbSeriesTitles[i].textContent=='Trim'){
            const checkedSeriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedSeriesList.length==0){
                const seriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<seriesList.length;j++){
                    const seriesInputValue = document.getElementById('Series').value;
                    const seriesValue = seriesList[j].textContent;
                    const seriesPatternString = `${seriesInputValue.split(' ').join('|')}`;
                    const seriesPattern = new RegExp(seriesPatternString,'gi');
                    if(seriesPattern.test(seriesValue)){
                        seriesList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==seriesList.length-1){
                        seriesList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }

    console.log('choosing kbb engine if not already chosen');
    kbbSeriesTitles = document.querySelectorAll('#ext-gen424 .optionField h2.optionFieldLabel');
    for(let i=0;i<kbbSeriesTitles.length;i++){
        if(kbbSeriesTitles[i].textContent=='Engine'){
            const checkedSeriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedSeriesList.length==0){
                const seriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<seriesList.length;j++){
                    const seriesInputValue = document.getElementById('Series').value;
                    const seriesValue = seriesList[j].textContent;
                    const seriesPatternString = `${seriesInputValue.split(' ').join('|')}`;
                    const seriesPattern = new RegExp(seriesPatternString,'gi');
                    if(seriesPattern.test(seriesValue)){
                        seriesList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==seriesList.length-1){
                        seriesList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }
    console.log('choosing kbb transmission if not already chosen');
    kbbSeriesTitles = document.querySelectorAll('#ext-gen424 .optionField h2.optionFieldLabel');
    for(let i=0;i<kbbSeriesTitles.length;i++){
        if(kbbSeriesTitles[i].textContent=='Transmission'){
            const checkedSeriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedSeriesList.length==0){
                const seriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<seriesList.length;j++){
                    const seriesInputValue = document.getElementById('Series').value;
                    const seriesValue = seriesList[j].textContent;
                    const seriesPatternString = `${seriesInputValue.split(' ').join('|')}`;
                    const seriesPattern = new RegExp(seriesPatternString,'gi');
                    if(seriesPattern.test(seriesValue)){
                        seriesList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==seriesList.length-1){
                        seriesList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }
    console.log('choosing kbb drivetrain if not already chosen');
    kbbSeriesTitles = document.querySelectorAll('#ext-gen424 .optionField h2.optionFieldLabel');
    for(let i=0;i<kbbSeriesTitles.length;i++){
        if(kbbSeriesTitles[i].textContent=='Drivetrain'){
            const checkedSeriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedSeriesList.length==0){
                const seriesList = kbbSeriesTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<seriesList.length;j++){
                    const seriesInputValue = document.getElementById('Series').value;
                    const seriesValue = seriesList[j].textContent;
                    const seriesPatternString = `${seriesInputValue.split(' ').join('|')}`;
                    const seriesPattern = new RegExp(seriesPatternString,'gi');
                    if(seriesPattern.test(seriesValue)){
                        seriesList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==seriesList.length-1){
                        seriesList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }


    console.log('opening mmr section');
    const mmrSectionOpener = document.querySelector('#ext-gen450');
    mmrSectionOpener.click();
    await sleep(5000);

    console.log('choosing mmr northeast region');
    const mmrRegions = document.querySelectorAll('#ext-gen444 .optionField .options ul.optionList li a');
    for(let i=0;i<mmrRegions.length;i++){
        if(mmrRegions[i].textContent=='Northeast'){
            mmrRegions[i].click();
            await sleep(5000);
            break;
        }
    }

    console.log('choosing mmr model if not already choosen');
    const mmrModelTitles = document.querySelectorAll('#ext-gen444 .optionField h2.optionFieldLabel');
    for(let i=0;i<mmrModelTitles.length;i++){
        if(mmrModelTitles[i].textContent=='Model'){
            const checkedModelList = mmrModelTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedModelList.length==0){
                const modelList = mmrModelTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<modelList.length;j++){
                    const modelInputValue = document.getElementById('Model').value;
                    const modelValue = modelList[j].textContent;
                    const modelPatternString = `${modelInputValue.split(' ').join('|')}`;
                    const modelPattern = new RegExp(modelPatternString,'gi');
                    if(modelPattern.test(modelValue)){
                        modelList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==modelList.length-1){
                        modelList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }

    console.log('choosing mmr trim if not already choosen');
    const mmrTrimTitles = document.querySelectorAll('#ext-gen444 .optionField h2.optionFieldLabel');
    for(let i=0;i<mmrTrimTitles.length;i++){
        if(mmrTrimTitles[i].textContent=='Trim'){
            const checkedTrimList = mmrTrimTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a.va-checkbox-checked');
            if(checkedTrimList.length==0){
                const trimList = mmrTrimTitles[i].nextElementSibling.querySelectorAll('span.va-checkbox a');
                for(let j=0;j<trimList.length;j++){
                    const trimInputValue = bodyTypeInput.value;
                    const trimValue = trimList[j].textContent;
                    const trimPatternString = `${trimInputValue.split(' ').join('|')}`;
                    const trimPattern = new RegExp(trimPatternString,'gi');
                    if(trimPattern.test(trimValue)){
                        trimList[j].click();
                        await sleep(5000);
                        break;
                    }
                    if(j==trimList.length-1){
                        trimList[0].click();
                        await sleep(5000);
                        break;
                    }
                }
            }
        }
    }



    const provisionPriceValue = document.querySelector('tr.primaryPrice.averagePrice>td.value:last-child').textContent;
    const jdPrice = document.querySelector('#ext-gen419 .priceTypeSummary.primary table.total td.value').textContent;
    const kbbPriceValue = document.querySelector('td.basePriceRanged').textContent;
    


    const digitPattern = /\d+/g;
    const provisionPrice = provisionPriceValue.match(/\d+/g).join('');
    const jdPriceValue = jdPrice.match(/\d+/g).join('');
    let mmrPriceValue = '0';
    try{
        const mmrPrice = document.querySelector('#ext-gen444 .priceTypeSummary.primary table.total td.value').textContent;
        mmrPriceValue = mmrPrice.match(/\d+/g).join('');
    }catch(e){
        mmrPriceValue= '0';
    }

    const kbbPrice = kbbPriceValue.match(/\d+/g).join('');
    const kbbFairPrice = document.querySelector('.stackedSummaryTable .priceTypeView .baseSection .rangeRow').textContent.split('-')[1].match(/\d+/g).join('');
    const kbbTradeValue = document.querySelectorAll('.stackedSummaryTable .stackedSummary:nth-child(2) .priceItems.total .value')[0].textContent.match(/\d+/g).join('');

    console.log('inputting certification cost');
    const certificationInput = document.getElementById('CertificationCost');
    const certificationCost = calculateCertificationCost(state);
    simulateTextEntry(certificationInput,certificationCost);
    await sleep(5000);


    console.log('inputting asking price');
    const minimumPrice = Math.min(provisionPrice,jdPriceValue,kbbPrice);
    const nearest500Value = Math.floor(minimumPrice/500)*500;
    const askingPrice = nearest500Value-1;
    const askingPriceInput = document.getElementById('AskingPriceField');
    simulateTextEntry(askingPriceInput,askingPrice);
    await sleep(5000);

    //accident count- All titles - Appraised Value  -  Seller price 
    let carfaxCheckValues = await carfaxResults(vin,sellerPrice);
    console.log(carfaxCheckValues);
    if(carfaxCheckValues==null){
        await sleep(5000);
        carfaxCheckValues = await carfaxResults(vin,sellerPrice);
        console.log(carfaxCheckValues);

    }
    if(carfaxCheckValues==null){
        await sleep(5000);
        carfaxCheckValues = await carfaxResults(vin,sellerPrice);
        console.log(carfaxCheckValues);
    }
    if(carfaxCheckValues==null){
        throw new Error('Carfax check failed');
        return {
            'updates': `-Manual- Couldn't get autocheck values`,
            'status': 'Manual',
        };
    }
    const appraisedValue = parseInt(document.getElementById('AppraisalValue').value);
    const nearest500AppraisedValue = Math.floor(appraisedValue/500)*500;

    let mmcOffer = nearest500AppraisedValue;
    if(sellerPrice-nearest500AppraisedValue < 2000){
        mmcOffer = Math.floor((sellerPrice-2000)/500)*500;
    }
    let result = {};
    if(carfaxCheckValues.accidentCount>=2 || carfaxCheckValues.isAirbagDeployed || carfaxCheckValues.isTotalLoss){
        result = {
            'updates': `AUTO\n-PASS- ${carfaxCheckValues.updateText}`,
            'status': 'Pass',
            'MMC Offer$': `${mmcOffer}`,
            'KBB Fair$' : `${kbbFairPrice}`,
            'KBB TIV' : `${kbbTradeValue}`,
            'Ave Mkt Price$': `${provisionPrice}`,
            'JDP $': `${jdPriceValue}`,
            'Ave $ MMR': `${mmrPriceValue}`,
        };
    }else{
        if(carfaxCheckValues.accidentCount==1 && sellerPrice>15000){
            result = {
                'updates': `${getEstDate()}-PASS- One accident and seller asking ${sellerPrice}\n ${carfaxCheckValues.updateText}`,
                'MMC Offer$': `${mmcOffer}`,
                'KBB Fair$' : `${kbbFairPrice}`,
                'KBB TIV' : `${kbbTradeValue}`,
                'Ave Mkt Price$': `${provisionPrice}`,
                'JDP $': `${jdPriceValue}`,
                'Ave $ MMR': `${mmrPriceValue}`,
                'status': 'Pass'
            };
        }else{
            if(carfaxCheckValues.isOdometerRollback){
                result = {
                    'updates': `${getEstDate()} ${carfaxCheckValues.updateText}-AUTO\nPossible Offer will be ${mmcOffer}-${mmcOffer+500}`,
                    'status': 'See My Note',
                    'MMC Offer$': `${mmcOffer}`,
                    'KBB Fair$' : `${kbbFairPrice}`,
                    'KBB TIV' : `${kbbTradeValue}`,
                    'Ave Mkt Price$': `${provisionPrice}`,
                    'JDP $': `${jdPriceValue}`,
                    'Ave $ MMR': `${mmrPriceValue}`,
                };
            }else{
                if(sellerPrice-mmcOffer > 5000){
                    result = {
                        'updates': `${getEstDate()}-PASS $- Seller asking 5k+ (${sellerPrice})-AUTO\nPossible Offer will be ${mmcOffer}-${mmcOffer+500}`,
                        'MMC Offer$': `${mmcOffer}`,
                        'KBB Fair$' : `${kbbFairPrice}`,
                        'KBB TIV' : `${kbbTradeValue}`,
                        'status': 'Pass $',
                        'Ave Mkt Price$': `${provisionPrice}`,
                        'JDP $': `${jdPriceValue}`,
                        'Ave $ MMR': `${mmrPriceValue}`,
                    }
                }else{
                    result = {
                        'updates': `${getEstDate()}-OFFER- ${mmcOffer}-${mmcOffer+500}-AUTO\nSeller asking ${sellerPrice}`,
                        'status': 'Initial Offer',
                        'MMC Offer$': `${mmcOffer}`,
                        'KBB Fair$' : `${kbbFairPrice}`,
                        'KBB TIV' : `${kbbTradeValue}`,
                        'Ave Mkt Price$': `${provisionPrice}`,
                        'JDP $': `${jdPriceValue}`,
                        'Ave $ MMR': `${mmrPriceValue}`,
                    }
                }
            }
        }
    }
    

    const notesOnVauto = `${result.updates}\n${url}\n${seriesSelectionText}`;
    simulateTextAreaEntry(vehicleDescriptionInput,notesOnVauto);
    await sleep(5000);
    // vehicleDescriptionInput.value = ;
    return result;
}



const validItemTitles = [
    'Vin#',
    'MMC Offer$',
    'Seller Counter$',
    'Price$',
    'Mileage',
    'State',
    'KBB Fair$',
    'status',
    'URL',
    "KBB TIV",
    "Vehicle",
    "Series",
    "Ave Mkt Price$",
    "JDP $",
    "Ave $ MMR"
    // 'BOT Status'
];
const validItemTitlesId = {
    'Vin#':'text6',
    'MMC Offer$':'numbers',
    'Seller Counter$':'numbers5',
    'Price$':'numbers4',
    'Mileage':'text_2',
    'State':'text_3',
    // 'KBB Fair$':'numbers55',
    'KBB Fair$':'numbers2',
    'status' : 'status',
    'URL': 'text7',
    "KBB TIV": "numbers52",
    "Vehicle": "text_1",
    "Series":"text62",
    "Ave Mkt Price$":"numbers34",
    "JDP $":"numbers_12",
    "Ave $ MMR":"numbers_2"
    // 'BOT Status':'text76',
};
const globalData = {
    boardId: '1255820475',
    borEffortBoardId: '1250230293',
    // boardId: '2886859118'
}
const mondayFetch = async (query,apiVersion="2024-01") => {
    const mondayResponse = await fetch (
        `https://api.monday.com/v2`,
        {
            cache: "no-cache",
            method: 'post',
            headers:{
                'Content-Type': 'application/json',
                'Authorization': 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjE3MjU1MTMxNiwidWlkIjozMDI3MzE5NCwiaWFkIjoiMjAyMi0wNy0yN1QyMzowMzowNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODg0NzExMCwicmduIjoidXNlMSJ9.OsVnuCUSnm-FF21sjAND10cWEKN9-UIqIkNx6Rz8Bfo',
                // 'Authorization' : 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjE1NTQ3NzM5NCwidWlkIjoyMTc2MjYwNiwiaWFkIjoiMjAyMi0wNC0xMlQxMzo0NjozOS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODg0NzExMCwicmduIjoidXNlMSJ9.mpXq7PtWbmneakwja8iB091bZFnElYif7Ji1IyBmmSA'
                'API-Version' : apiVersion
            },
            body: JSON.stringify({query})
        }
    );  
    return await mondayResponse.json();
}
const getItemFromMonday = async (item_id) => {
    // const getNewItemId = await fetch('');
    const boardId = globalData.boardId;

    // const itemQuery = `
    //     query{
    //         items_by_column_values (board_id: ${boardId}, column_id: "status", column_value: "Auto Vin",limit:1) {
    //             id,
    //             column_values(){
    //                 value,
    //                 title
    //             }
    //         }
    //     }
    // `;
    const itemQuery = `
        query{
            items_page_by_column_values(board_id: ${boardId}, columns:[{column_id: "status", column_value: "Auto Vin"}], limit:1) {
                items{
                    id,
                    column_values{
                        value,
                        text
                    }
                }
            }
    `;
    let itemCount = 0;
    while(itemCount==0){
        let titleCheckData = await mondayFetch(itemQuery); 
        // if(titleCheckData.data.items_by_column_values.length==0){
        if(titleCheckData.data.items_page_by_column_values.items.length==0){
            await sleep(300000); 
            window.location.reload();
            return false;
        }else{
            // itemCount = titleCheckData.data.items_by_column_values.length;
            itemCount = titleCheckData.data.items_page_by_column_values.items.length;
            const validItemValues = {};
            validItemValues.status = '"Auto Vin"';
            // const itemValues = titleCheckData.data.items_by_column_values[itemCount-1].column_values;
            const itemValues = titleCheckData.data.items_page_by_column_values.items[itemCount-1].column_values;
            // validItemValues.id = titleCheckData.data.items_by_column_values[itemCount-1].id;
            validItemValues.id = titleCheckData.data.items_page_by_column_values.items[itemCount-1].id;
            for(let i=0;i<itemValues.length;i++){
                if(validItemTitles.includes(itemValues[i].text)){
                    validItemValues[itemValues[i].text] = itemValues[i].value;
                }
            }
            const keys = Object.keys(validItemValues);
            for(let i=0;i<keys.length;i++){
                console.log(`${keys[i]} : ${validItemValues[keys[i]]}`);
                validItemValues[keys[i]] = JSON.parse(validItemValues[keys[i]]);
            }
            await mondayItemDB.SET(validItemValues);
            return validItemValues;
        }
    }
}
const getSingleItemFromMonday = async(serverItem)=>{
    const id = serverItem.item_id;
    // 1255820475
    const query = `
        query{
            items(ids:[${id}]){
                board{
                    id
                }
                column_values{
                    value,
                    column{
                        title
                    }
                }
            }

        }
    `;
    const mondayResponse = await mondayFetch(query);
    // const items = mondayResponse.data.boards[0].items;
    const items = mondayResponse.data.items;
    console.log(items);
    // throw new Error('test');
    // board is not 1255820475
    if(items.length==0 && mondayResponse.data.items[0]?.board?.id!=globalData.boardId){
        // window.location.reload();
        console.log('board is not 1255820475');
        return null;
    }else{
        console.log('board test passed');
        const item = items[0];
        const columnValues = item.column_values;
        const validItemValues = {};
        for(let i=0;i<columnValues.length;i++){
            // if(validItemTitles.includes(columnValues[i].text)){
            if(validItemTitlesId[columnValues[i].column.title]!=null){
                // validItemValues[columnValues[i].text] = columnValues[i].value;
                validItemValues[columnValues[i].column.title] = columnValues[i].value;
            }
        }
        const keys = Object.keys(validItemValues);
        for(let i=0;i<keys.length;i++){
            validItemValues[keys[i]] = JSON.parse(validItemValues[keys[i]]);
        }
        validItemValues.id = id;
        console.log(validItemValues);
        await mondayItemDB.SET({monday:validItemValues,server:serverItem,local:{}});
        return {monday:validItemValues,server:serverItem,local:{}};
    }

};
const updateItemToMonday = async(updateData)=>{
    const boardId = globalData.boardId;
    const itemId = (await mondayItemDB.GET()).monday.id;
    console.log(itemId);
    console.log(updateData);
    if(updateData.updates!=null){
        const updatesJson = JSON.stringify(updateData.updates);
        const updatesQuery = `
            mutation{
                create_update (item_id: ${itemId}, body: ${updatesJson}) {
                    id
                }
            }
        `;
        console.log('updating query');
        console.log(updatesQuery);
        await mondayFetch(updatesQuery);
    }
    let updateColumnValues = {};
    const updateColumnTitles = Object.keys(updateData);
    for(let i=0;i<updateColumnTitles.length;i++){
        if(updateColumnTitles[i]!='updates'){
            updateColumnValues[validItemTitlesId[updateColumnTitles[i]]] = updateData[updateColumnTitles[i]];
        }
    }
    console.log(updateColumnValues);
    // if(Object.keys(updateColumnValues).length>0){
    //     updateColumnValues[validItemTitlesId['BOT Status']] = 'done';
    // }
    let updateColumnValuesJson = JSON.stringify(updateColumnValues);
    if(updateColumnValuesJson!='{}'){

        updateColumnValuesJson = JSON.stringify(`${updateColumnValuesJson}`)
        const updateColumnQuery = `
            mutation{
                change_multiple_column_values(item_id:${itemId}, board_id:${boardId}, column_values: ${updateColumnValuesJson}) {
                id
                }
            }
        `;
        console.log(updateColumnQuery);
        await mondayFetch(updateColumnQuery);
    }
}
const collectNewMessageFromChat = async () => {
    const popupMetaDB = new ChromeStorage('metaInformation');
    const popupMeta = await popupMetaDB.GET();
    const domain = popupMeta.domain;
    const dashBoardDataJson = await fetch(`${domain}/vauto/getDashBoardData`,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const dashBoardData = await dashBoardDataJson.json();
    // const fb_ids = dashBoardData.map((item)=>item.fb_id);
    // const sellerRepliedItemId = {};
    // for(let i = 0; i < dashBoardData.length; i++){
    //     const item = dashBoardData[i];
    //     const fb_id = item.fb_id;
    //     sellerRepliedItemId[fb_id] = item.sellerReplies;
    //     item.sellerReplies = 0;
    // }
    // const sellerRepliedItemIds = [];
    // for(const fb_id in sellerRepliedItemId){
    //     sellerRepliedItemIds.push(...sellerRepliedItemId[fb_id]);
    // }
    // const query = `
    //         query{
    //             boards(ids:[${globalData.borEffortBoardId}]){
    //                 items(limit:1000,ids:[${sellerRepliedItemIds.map(id=>`${id}`)}]){
    //                     id
    //                 }
    //             }
    //         }
    //     `;
    // const query = `
    //     query{
    //         items(ids:[${sellerRepliedItemIds.map(id=>`${id}`)}]){
    //             id,
    //             board{
    //                 id
    //             }
    //         }
    //     }
    // `;
    // const mondayItemsData = await mondayFetch(query);
    // const mondayItemsdata = await mondayItemsDataJson.json();
    // const activeSellerRepliedItemIds = mondayItemsData.data.boards[0].items.map(item=>item.id);
    const borEffortBoardId = globalData.borEffortBoardId;
    const activeSellerRepliedItemIds = mondayItemsData.data.items.map(item=>{
        if(item.board.id==borEffortBoardId){
            return item.id;
        }
    });

    console.log(activeSellerRepliedItemIds);
    if(activeSellerRepliedItemIds.length>0){
        await fetch(`${domain}/vauto/collectedNewMessageFromChat`,{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    
    // await sleep(100000);
};
const calculateMondayItemRawVin = async () => {
    const result = {};
    const mondayItem = (await mondayItemDB.GET()).monday;
    const vin = mondayItem['Vin#'];
    const mileage = mondayItem['Mileage'];
    const state = mondayItem['State'];
    const sellerPrice = mondayItem['Price$'];
    const vehicle = mondayItem['Vehicle'];
    const series = mondayItem['Series'];
    const url = mondayItem['URL'];
    console.log('calculating item',mondayItem);
    // const localVins = await mondayItemVinDB.GET();
    // const done = mondayItem['BOT Status'];
    // const done = localVins.includes(vin);
    // const done = false;
    // if(!done){
    // if(mondayItem.status=='Auto Vin'){
    if(typeof vin=='string' && typeof mileage == 'string' && typeof state == 'string' && typeof sellerPrice == 'string'){
        if(vin.length == 17){
            if(mileage.length>0 && state.length>0 && sellerPrice.length>0){
                if(getCarVinFromText(vin)==null){
                    return {
                        suggest: false,
                        data: {
                            'updates': 'Vin is not correct',
                            'status': 'Invalid Vin'
                        }
                    };
                }else{
                    result.vin = vin;
                    result.mileage = mileage;
                    result.state = state;
                    result.sellerPrice = sellerPrice;
                    result.vehicle = vehicle;
                    result.series = series;
                    result.url = url;
                    result.suggest = true;
                    return result; 
                }
                 
            }else{
                return {
                    suggest: false,
                    data: {
                        'updates': 'VIN / Mileage / State / Price / vehicle is(are) empty',
                        'status': 'Empty Value'
                    }
                };
            }
        }else{
            return {
                suggest: false,
                data: {
                    'updates': 'VIN / Mileage / State / Price/ Vehicle is(are) empty',
                    'status': 'Invalid Vin'
                }
            };
        }
    }else{
        return {
            suggest: false,
            data: {
                'updates': 'VIN / Mileage / State / Price / vehicle is(are) empty',
                'status': 'Empty Value'
            }
        };
    }
    // }
    // }else{
    //     console.log('neglecting cause monday sent it again');
    //     return {
    //         suggest: false,
    //         data: {}
    //     };
    // }
}


const fixedData = {
    metaInformation:{
        fireMode:{
            title: 'Fire Mode',
            type: 'checkbox',
            defaultValue: false,
            point: 'checked',
            interactive: true,
            requiredToStart: false,
        },
        deviceId:{
            title: 'Device Id',
            type: 'text',
            defaultValue: '',
            point: 'value',
            interactive: true,
            requiredToStart: true,
        },
        defaultAPI:{
            title: 'Default API',
            type: 'text',
            defaultValue: 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjE3MjU1MTMxNiwidWlkIjozMDI3MzE5NCwiaWFkIjoiMjAyMi0wNy0yN1QyMzowMzowNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6ODg0NzExMCwicmduIjoidXNlMSJ9.OsVnuCUSnm-FF21sjAND10cWEKN9-UIqIkNx6Rz8Bfo',
            point: 'value',
            interactive: true,
            requiredToStart: true,
        },
        domain:{
            title: 'Domain',
            type: 'text',
            defaultValue: 'https://weuit.com',
            point: 'value',
            interactive: true,
            requiredToStart: true,
        },
    },
    workingSelectors:{
        content:{
            console: 'CONTENT_CONSOLE',
        },
    },
    urls:{
        logoutRedirectionUrl: "https://laserappraiser.com/login",
        baseUrl: "https://mvs.laserappraiserservices.com/mvs/vehicleList",
        appraiseUrl: "https://mvs.laserappraiserservices.com/mvs/vehicleDetail"
    },
    errorNotices: {
        sessionError: "Please logout then login and try again"
    }
};


const setupConsoleBoard= ()=>{
    const consoleBoard = document.createElement('div');
    consoleBoard.id = fixedData.workingSelectors.content.console;
    dragElement(consoleBoard);
    function dragElement(elmnt) {
        var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        if (document.getElementById(elmnt.id + "header")) {
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
        } else {
        elmnt.onmousedown = dragMouseDown;
        }
    
        function dragMouseDown(e) {
        e = e || window.event;
        // e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        }
    
        function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
        elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
        }
    
        function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        }
    }
    document.body.appendChild(consoleBoard);
}
const showDataOnConsole= (data)=>{
    const consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
    const content = document.createElement('div');
    content.classList.add('font-sub');
    content.innerText = data;
    consoleBoard.appendChild(content);
    console.log(data);
}

const serverResponse = async ({directory,item_ids=[],data={},fireMode=null}) => {
    const metaInformationDB = new ChromeStorage('metaInformation');
    const metaInformation = await metaInformationDB.GET();
    const deviceId = metaInformation.deviceId;
    const domain = metaInformation.domain;
    console.log(`${domain}/vauto/${directory}`);
    const responseJSON = await fetch(
        `${domain}/vauto/${directory}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device_id: deviceId,
                item_ids: item_ids,
                data: data,
                fireMode: fireMode
            }),
        }
    );
    const response = await responseJSON.json();
    return response;
}
const getAutoVinIds = async()=>{
    const query = `
        query{
            boards(ids:[1255820475]){
                items_page(limit:500){
                    items{
                        id
                        column_values(ids:["status"]){
                            value,
                        }
                    }
                }
            }
        }
    `;
    const response = await mondayFetch(query);
    const data = response.data.boards[0].items_page.items;
    // ids that has status Auto VIn
    console.log(data);
    data.map(item=>{
        console.log(JSON.parse(item.column_values[0].value)) 
        console.log(JSON.parse(item.column_values[0].value).index)
    })
    const itemsFiltered = data.filter(item=>(JSON.parse(item.column_values[0].value)).index === 105).map(item=>item.id);
    console.log(itemsFiltered)
    return itemsFiltered;
}
const isItemActiveOnChat = async (item_id)=>{
    const metaInformationDB = new ChromeStorage('metaInformation');
    const metaInformation = await metaInformationDB.GET();
    const domain = metaInformation.domain;
    const responseJSON = await fetch(`${domain}/vauto/isItemActiveOnChat`,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            item_id,
        }),
    });
    const response = await responseJSON.json();
    return response;
}
const setAutomatedOfferMessage = async(data)=>{
    const metaInformationDB = new ChromeStorage('metaInformation');
    const metaInformation = await metaInformationDB.GET();
    const domain = metaInformation.domain;
    const responseJSON = await fetch(`${domain}/vauto/setAutomatedOfferMessage`,{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
    const response = await responseJSON.json();
    return response;
};
const getCarVinFromText = (text)=>{
    text = text+'';
    text = text.toUpperCase();
    text = text.replace(/[^A-Z0-9]/g, '');
    const vinRegex = /([A-HJ-NPR-Z\d]{8})([X\d]{1})([E-HJ-NPR-TV]{1})([A-HJ-NPR-Z\d]{2})([\d]{5})/;
    const vinMatch = vinRegex.exec(text);
    let vin = '';
    if(vinMatch){
        vin = vinMatch[0];
        const beforeCheckDigit = vin.substring(0, 8);
        const checkDigit = vin.substring(8, 9)=="X"?"10":parseInt(vin.substring(8, 9));
        const afterCheckDigit = vin.substring(9);
        const stringWithoutCheckDigit = beforeCheckDigit + afterCheckDigit;
        const changeLetterToNumberValue = (letter)=>{
            // no i,O,Q
            letter = letter.replace(/[AJ]/g, '1');
            letter = letter.replace(/[BKS]/g, '2');
            letter = letter.replace(/[CLT]/g, '3');
            letter = letter.replace(/[DMU]/g, '4');
            letter = letter.replace(/[ENV]/g, '5');
            letter = letter.replace(/[FW]/g, '6');
            letter = letter.replace(/[GPX]/g, '7');
            letter = letter.replace(/[HY]/g, '8');
            letter = letter.replace(/[RZ]/g, '9');
            return letter;
        };
        const numberWithoutCheckDigit = changeLetterToNumberValue(stringWithoutCheckDigit);
        const numberWeights = [8, 7, 6, 5, 4, 3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2];
        const numberArray = numberWithoutCheckDigit.split('');
        let sum = 0;
        for(let i=0; i<numberArray.length; i++){
            sum += numberArray[i]*numberWeights[i];
        }
        const checkDigitCalculatedValue = sum%11;
        if(checkDigitCalculatedValue==checkDigit){
            return vin;
        }else{
            console.log('Wrong Vin');
            return null;
        }
    }else{
        console.log('No vin found');
        return null;
    }
}
const popupSetup = async () => {
    console.log('popup');
    document.body.id ="POPUP";
    const metas = fixedData.metaInformation;
    const popupMetaDB = new ChromeStorage('metaInformation');
    let popupMetaValues = await popupMetaDB.GET();
    popupMetaValues = popupMetaValues==null?{}:popupMetaValues;
    const metaKeys = Object.keys(metas);
    for(let i=0;i<metaKeys.length;i++){
        const metaKey = metaKeys[i];
        const meta = metas[metaKey];
        if(meta.interactive==true){
            const label = document.createElement('label');
            label.innerText = meta.title;
            const input = document.createElement('input');
            input.setAttribute('type', meta.type);
            input.setAttribute('id', metaKey);
            // input.setAttribute('placeholder', meta.title);
            // input.setAttribute(meta.point, meta.defaultValue);
            if(popupMetaValues[metaKey]==null){
                popupMetaValues[metaKey] = meta.defaultValue;
            }
            input[meta.point] = popupMetaValues[metaKey];
            document.body.append(label,input);
        }else{
            // readd only
            const label = document.createElement('label');
            label.innerText = `${meta.title}: ${popupMetaValues[metaKey]}`;
            document.body.append(label);
        }
    }
    const saveButton = document.createElement('button');
    saveButton.innerText = 'Save';
    saveButton.addEventListener('click', async ()=>{
        for(let i=0;i<metaKeys.length;i++){
            if(metas[metaKeys[i]].interactive==true){
                const metaKey = metaKeys[i];
                const meta = metas[metaKey];
                popupMetaValues[metaKey] = document.getElementById(metaKey)[meta.point];
            }
        }
        await popupMetaDB.SET(popupMetaValues);
        window.close();
    });
    document.body.appendChild(saveButton);
};

const contentSetup = async (position=null) => {
    console.log(window.location.href);
    let mondayItem = await mondayItemDB.GET();
    let consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
    switch (position) {
        case null:
            consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
            if(consoleBoard!=null){
                consoleBoard.remove();
            }
            setupConsoleBoard();
        case 'noItemInLocalDB':
            const mondayItemExits = await mondayItemDB.GET() != null;
            consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
            if(!mondayItemExits){
                console.log('no item in local db');
                const metaInformationDB = new ChromeStorage('metaInformation');
                const isFireMode = (await metaInformationDB.GET()).fireMode;
                let newItem = await serverResponse({directory:'getNewItemId',fireMode:isFireMode});
                console.log(newItem.action);
                if(newItem.action=='setDeviceId'){
                    showDataOnConsole('setDeviceId');
                    return false;
                }else if(newItem.action=='tryLaterAgain'){
                    showDataOnConsole('waiting...');
                    consoleBoard.style.backgroundColor = 'yellow';
                    await sleep(300*1000);
                    await contentSetup('noItemInLocalDB');
                    return false;
                }else if(newItem.action=='collectNewItem'){
                    const item_ids = await getAutoVinIds();
                    console.log(item_ids);
                    const response = await serverResponse({directory:'uploadNewItems',item_ids});
                    // await collectNewMessageFromChat();
                    await contentSetup('noItemInLocalDB');
                    return false;
                }else if(newItem.action=='workOnItem'){
                    // console.log(newItem);
                    // return false;
                    const item_id = newItem.item_id;
                    const getMondayItem = await getSingleItemFromMonday(newItem);
                    if(getMondayItem==null){
                        await contentSetup('noItemInLocalDB');
                        return false;
                    }
                }else{
                    console.log('something went wrong');
                    return false;
                }
            }
        case 'verifyAppraiser':
            document.getElementById(fixedData.workingSelectors.content.console).style.backgroundColor = 'green';
            mondayItem = await mondayItemDB.GET();
            if(mondayItem.local.step==null || mondayItem.local.step=='verifyAppraiser'){
                const currentUrl = window.location.href;
                if(currentUrl.includes(fixedData.urls.baseUrl)){
                    const loginInput = document.querySelector("input#login");
                    const passwordInput = document.querySelector("input#password");
                    const submitButton = document.querySelector("form#login input[type='submit']");
                    if(loginInput!=null || passwordInput!=null){
                        console.log(mondayItem)
                        const username = mondayItem.server.data.username;
                        const password = mondayItem.server.data.password;
                        simulateTextEntry(loginInput, username);
                        simulateTextEntry(passwordInput, password);
                        submitButton.click();
                        console.log('program should have logged in by now');
                        return false;
                    }else{
                        // href has deviceId in it
                        const laserIdUrl = document.querySelector("a[href*='deviceId']");
                        if(laserIdUrl!=null){
                            const laserId = new URL(laserIdUrl.href).searchParams.get('deviceId');
                            if(currentUrl==fixedData.urls.baseUrl){
                                const appraiser = document.querySelector(`#main_navbar .profile_informations h3`)||{};
                                console.log(appraiser.innerText,mondayItem.server.data.display_name);
                                console.log(mondayItem)
                                if(appraiser.innerText==mondayItem.server.data.display_name){
                                    mondayItem.local.step = 'verifyItem';
                                    mondayItem.local.laserId = laserId;
                                    await mondayItemDB.SET(mondayItem);
                                }else{
                                    console.log('appraiser not found');
                                    document.getElementById(fixedData.workingSelectors.content.console).style.backgroundColor = 'red';
                                }
                            }
                        }else{  
                            console.log('do not know what we are doing here');
                            document.getElementById(fixedData.workingSelectors.content.console).style.backgroundColor = 'red';
                        }
                    }
    
    
                }else{
                    console.log('not in base url');
                    window.location.href = fixedData.urls.baseUrl;
                    return false;
                }
            }
        case 'verifyItem':
            mondayItem = await mondayItemDB.GET();
            if(mondayItem.local.step=='verifyItem'){
                const itemResult = await calculateMondayItemRawVin();
                if(!itemResult.suggest){
                    mondayItem.local.result = itemResult.data;
                    mondayItem.local.step = 'final';
                    await mondayItemDB.SET(mondayItem);
                    await contentSetup('final');
                    return false;
                }else{
                    mondayItem.local.step = 'suggestItem';
                    mondayItem.local.item = itemResult;
                    await mondayItemDB.SET(mondayItem);
                    await contentSetup('suggestItem');
                    return false;
                }
            }
        case 'suggestItem':
            mondayItem = await mondayItemDB.GET();
            await sleep(3000);
            const appraisalResult = async (info)=>{
                // let re
                const vin = info.vin;
                const mileage = info.mileage;
                const state = info.state;
                const sellerPrice = parseInt(info.sellerPrice);
                const vehicle = info.vehicle;
                const series = info.series;
                const url = info.url;
                // {
                //     const selectElement = document.getElementById("kbb_condition");

                //     // Loop through each option to find the one with the value "Good"
                //     for (let i = 0; i < selectElement.options.length; i++) {
                //         if (selectElement.options[i].value === "VeryGood") {
                //             // Set the selectedIndex property of the select element to the index of the "Good" option
                //             selectElement.selectedIndex = i;
                //             // Trigger a change event to simulate the change
                //             const event = new Event('change');
                //             selectElement.dispatchEvent(event);
                //             break;
                //         }
                //     }
                // }
                const kbb = document.querySelector("td#kbb_trade_xclt_adj");
                const jd = document.querySelector("td#nada_retail_rtl_adj");
                const kbbRetail = document.querySelector("td#kbb_misc_retail_adj");
                if(kbb!=null || jd!=null || kbbRetail!=null){
                    const laserSeriesSelection = async () => {
                        const seriesInput = document.querySelector("#trim_select");
                        if(!seriesInput) return 'series provided';
                        // const inputHolder = seriesInput.values;
                        const seriesOptions = seriesInput.children;
                        const changeAndWaitForUpdate = async()=>{
                            seriesInput.dispatchEvent(new Event('change'));
                            while(!(document.querySelector("#trim_select").value==document.querySelector("#kbb_select_trim")?.value  || document.querySelector("#trim_select").value==document.querySelector("#nada_select_trim")?.value)){

                                if(document.querySelector("#kbb_select_trim")==null && document.querySelector("#nada_select_trim")==null){
                                    break;
                                }
                                await sleep(5000);
                                console.log('inside loops')
                            }
                        }
                        // if(seriesInput.value=='' || seriesInput.value==null){
                        //     for(let i=0;i<seriesOptions.length;i++){
                        //         if(series==null) break;
                        //         const seriesOption = seriesOptions[i];
                        //         if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                        //             if(seriesOption.textContent.toLowerCase()==series.toLowerCase()){
                        //                 const result =`Manually selected series using lead verifier provided series. Selected Series ${seriesOption.textContent}`;
                        //                 seriesOption.selected = true;
                        //                 // distpatch even change
                        //                 await changeAndWaitForUpdate();
                        //                 return result;
                        //             }
                        //         }
                        //     }
                        // }
                        // vehicle title selection
                        // for(let i=0;i<seriesOptions.length;i++){
                        //     const seriesOption = seriesOptions[i];
                        //     if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                        //         if(seriesOption.textContent.split(' ').length==1 && vehicle.toLowerCase().split((' ')).includes(seriesOption.textContent.toLowerCase())){
                        //             const result =`Manually selected series using Vehicle title. Selected Series ${seriesOption.textContent}`;
                        //             seriesOption.selected = true;
                        //             await changeAndWaitForUpdate();
                        //             return result;
                        //         }
                        //         if(seriesOption.textContent.split(' ').length>1 && vehicle.toLowerCase().match(new RegExp(seriesOption.textContent.toLowerCase().split(' ').join('|'),'gi'))){
                        //             const result =`Manually selected series using Vehicle title. Selected Series ${seriesOption.textContent}`;
                        //             seriesOption.selected = true;
                        //             await changeAndWaitForUpdate();
                        //             return result;
                        //         }
                        //     }
                        // }
                        //exception rules
                        for(let i=0;i<seriesOptions.length;i++){
                            const seriesOption = seriesOptions[i];
                            if(seriesOption.textContent!='' && seriesOption.textContent!= ' ' && seriesOption.textContent!= null){
                                //depends on vehicle title
                                if(vehicle.match(/(^)Ford.+(((F?:\s|-)(?:150|250|350|))|Maverick|Ranger|Lightening)/gi) && seriesOption.textContent.toLowerCase().includes('xlt')){
                                    const result =`Manually selected series using ford exception rule. Selected Series ${seriesOption.textContent}`;
                                    seriesOption.selected = true;
                                    await changeAndWaitForUpdate();
                                    return result;
                                }
                                if(vehicle.match(/(^)Nissan/gi) && seriesOption.textContent.toLowerCase().includes('SV Sport')){
                                    const result =`Manually selected series using nissan exception rule. Selected Series ${seriesOption.textContent}`;
                                    seriesOption.selected = true;
                                    await changeAndWaitForUpdate();
                                    return result;
                                }
                                // depends on vauto values
                                if(document.querySelector('input[value="Jeep"]') && document.querySelector('input[value="Grand Cherokee"') && seriesOption.textContent.toLowerCase().includes('Laredo Sport')){
                                    const result =`Manually selected series using jeep exception rule. Selected Series ${seriesOption.textContent}`;
                                    seriesOption.selected = true;
                                    await changeAndWaitForUpdate();
                                    return result;
                                }
                            }
                        }
                            
                        if(seriesOptions.length>1){
                            const result =`Manually selected series using first option. Selected Series ${seriesOptions[1].textContent}`;
                            if(seriesOptions[0].selected){
                                seriesOptions[1].selected = true;
                                await changeAndWaitForUpdate();
                            }
                            return result;
                        }
                        
                        return 'No Series Rules to follow';
                    }
                    let seriesSelected = '';
                    if(vehicle){

                        seriesSelected = await laserSeriesSelection();
                        console.log('laser selection done')
                    }
                    let kbbPriceValue = document.querySelector("td#kbb_trade_xclt_adj")?.textContent*1 || 0;
                    let jdPriceValue = document.querySelector("td#nada_retail_rtl_adj")?.textContent*1 || 0;
                    let kbbRetailValue = document.querySelector("td#kbb_misc_retail_adj")?.textContent*1 || 0;
                    // if(isNaN(kbbPriceValue) && isNaN(jdPriceValue) && isNaN(kbbRetailValue)){
                    //     // throw new Error('Could not get values');
                    //     return {
                    //         'updates': `-Manual- Couldn't get values NAN \n${seriesSelected}`,
                    //         'status': 'Manual',
                    //     };
                    // }else if(kbbPriceValue==0 && jdPriceValue==0 && kbbRetailValue==0){
                    //     // throw new Error('Could not get values');
                    //     return {
                    //         'updates': `-Manual- Couldn't get values value 0\n${seriesSelected}`,
                    //         'status': 'Manual',
                    //     };
                    // }else{
                    //     // either of them can be zero
                    //     let fromKbb = false;
                    //     extraText = [];
                    //     extraText.push(`\n\tAppraisal Calculation:`);
                    //     extraText.push(`\n\t\tJD POWER Value($${jdPriceValue})`);
                    //     extraText.push(`\n\t\tKBB Trade Excellent Value($${kbbPriceValue}+$500= $${kbbPriceValue+500})`);
                    //     kbbPriceValue = kbbPriceValue + 500;
                    //     extraText.push(`\n\t\tKBB Retail Adjusted Value($${kbbRetailValue})`);
                    //     const certificationCost = calculateCertificationCost(state);
                    //     extraText.push(`\n\t\tCertification Cost: $${certificationCost}`);
                    //     const reconditioningCost = 400;
                    //     extraText.push(`\n\t\tReconditioning Cost: $${reconditioningCost}`);
                    //     const profit = 2000;
                    //     extraText.push(`\n\t\tProfit: $${profit}`);
                    //     const mimimumDifference = 1500;
                        
                    //     let mmcOffer = 0;
                    //     if(jdPriceValue!=0 || kbbRetailValue!=0){
                    //         if(jdPriceValue==0){
                    //             jdPriceValue = kbbRetailValue;
                    //         }
                    //         if(kbbRetailValue==0){
                    //             kbbRetailValue = jdPriceValue;
                    //         }
                    //         const minimumPrice = Math.min(jdPriceValue,kbbRetailValue);
                    //         const nearest500Value = Math.floor(minimumPrice/500)*500;
                    //         extraText.push(`\n\t\t Nearest 500 Value: $${nearest500Value}`);
                    //         const askingPrice = nearest500Value-1;
                    //         extraText.push(`\n\t\tAfter Subtracting 1: $${askingPrice}`);
    
                    //         const appraisedValue = askingPrice-certificationCost-reconditioningCost-profit;
                    //         extraText.push(`\n\t\tPre Appraised Value: $${appraisedValue}`);
                    //         const nearest500AppraisedValue = Math.floor(appraisedValue/500)*500;
                    //         extraText.push(`\n\t\tNearest 500 Appraised Value: $${nearest500AppraisedValue}`);
                    //         mmcOffer = nearest500AppraisedValue;
                    //         if(sellerPrice-nearest500AppraisedValue < mimimumDifference){
                    //             mmcOffer = Math.floor((sellerPrice-mimimumDifference)/500)*500;
                    //             extraText.push(`\n\t\tAfter applying minimum price difference $${mimimumDifference} offer will be $${mmcOffer} as seller asking $${sellerPrice} is less than minimum difference`);
                    //         }
                    //     }
                        
                        

                    //     if(kbbPriceValue!=0){
                    //         const kbbTradeVeryGood = kbbPriceValue;
                    //         const nearest500KbbTradeVeryGood = Math.floor(kbbTradeVeryGood/500)*500;
                    //         // if(!(nearest500KbbTradeVeryGood==0 || isNaN(nearest500KbbTradeVeryGood)) ){
                    //         extraText.push(`\n\t\tKBB Trade Excellent price ($${kbbTradeVeryGood})`);  
                    //         extraText.push(`\n\t\tNearest 500 Value of KBB Trade Excellent price: $${nearest500KbbTradeVeryGood}`);
                    //         if(mmcOffer > nearest500KbbTradeVeryGood-500 || nearest500KbbTradeVeryGood+calculateCertificationCost(state)+reconditioningCost < sellerPrice){
                    //             extraText.push(`\n\t\tCurrent MMC Offer is more than KBB Trade Excellent price. So offer is $${nearest500KbbTradeVeryGood}`);
                    //             fromKbb = true;
                    //             if(nearest500KbbTradeVeryGood+calculateCertificationCost(state)+reconditioningCost < sellerPrice){
                    //                 mmcOffer = nearest500KbbTradeVeryGood;
                    //             }else{
                    //                 mmcOffer = Math.min(mmcOffer,nearest500KbbTradeVeryGood);
                    //             }
                    //         }else{
                    //             extraText.push(`\n\t\tCurrent MMC Offer is less than KBB Trade Excellent price. So offer is $${mmcOffer}`);
                    //         }
                    //         // }
                    //         if(fromKbb){
                    //             extraText.push(`\n\t\tNearest 500 Value: ${nearest500KbbTradeVeryGood}`);  
                    //             extraText.push(`\n\t\tAppraising using KBB Trade Excellent price`); 
                    //             // remove rest of the lines\
                    //             // extraText = extraText.slice(0,3);
                    //         }
                    //     }
                        
                    //     const maximumPriceDifferenece = 5000;
                        
                    //     if(mmcOffer<=0){
                    //         return {
                    //             'updates': `-Manual- Program says mmc offer is zero or less${extraText.join('')}`,
                    //             'status': 'Manual',
                    //         };
                    //     }else if(sellerPrice-mmcOffer > maximumPriceDifferenece){
                    //         return {
                    //             'updates': `${getEstDate()}-PASS $- Seller asking 5k+ (${sellerPrice})-AUTO\nPossible Offer will be ${mmcOffer}-${mmcOffer+500}\n${url}\n${seriesSelected}${extraText.join('')}`,
                    //             'MMC Offer$': `${mmcOffer}`,
                    //             // 'KBB Fair$' : `${kbbFairPrice}`,
                    //             // 'KBB TIV' : `${kbbTradeValue}`,
                    //             'status': 'Pass $',
                    //             // 'Ave Mkt Price$': `${provisionPrice}`,
                    //             'JDP $': `${jdPriceValue}`,
                    //             // 'Ave $ MMR': `${mmrPriceValue}`,
                    //         }
                    //     }else{
                    //         return {
                    //             'updates': `${getEstDate()}-OFFER- ${mmcOffer}-${mmcOffer+500}-AUTO\nSeller asking ${sellerPrice}\n${url}\n${seriesSelected}${extraText.join('')}`,
                    //             'status': 'Initial Offer',
                    //             'MMC Offer$': `${mmcOffer}`,
                    //             // 'KBB Fair$' : `${kbbFairPrice}`,
                    //             // 'KBB TIV' : `${kbbTradeValue}`,
                    //             // 'Ave Mkt Price$': `${provisionPrice}`,
                    //             'JDP $': `${jdPriceValue}`,
                    //             // 'Ave $ MMR': `${mmrPriceValue}`,
                    //         }
                    //     }
                    // }
                    const extraText = [];
                    extraText.push(`\n\tAppraisal Calculation:`);
                    extraText.push(`\n\t\tJD POWER Value($${jdPriceValue})`);
                    extraText.push(`\n\t\tKBB Trade Excellent Value($${kbbPriceValue}+$500= $${kbbPriceValue+500})`);
                    kbbPriceValue = kbbPriceValue + 500;
                    extraText.push(`\n\t\tKBB Retail Adjusted Value($${kbbRetailValue})`);

                    



                    if(isNaN(kbbPriceValue) && isNaN(jdPriceValue) && isNaN(kbbRetailValue)){
                        // throw new Error('Could not get values');
                        return {
                            'updates': `-Manual- Couldn't get any values \n${seriesSelected}`,
                            'status': 'Manual',
                        };
                    }else if(kbbPriceValue==0 && jdPriceValue==0 && kbbRetailValue==0){
                        return {
                            'updates': `-Manual- Couldn't get any values NAN \n${seriesSelected}`,
                            'status': 'Manual',
                        };
                    }else{
                        if(jdPriceValue*1==0 && kbbRetailValue*1==0){
                            return {
                                'updates': `-Manual- Program couldn't get jdPrice or kbb retail price${extraText.join('')}`,
                                'status': 'Manual',
                            };
                        }else{
                            if(jdPriceValue*1==0){
                                jdPriceValue = kbbRetailValue;
                            }
                            if(kbbRetailValue*1==0){
                                kbbRetailValue = jdPriceValue;
                            }
                        }
                        let mmcOffer = 0;
                        const maximumPriceDifferenece = 5000;
                        const retailValue = Math.min(jdPriceValue,kbbRetailValue)
                        extraText.push(`\n\t\tRetail Value will be: $${retailValue}`);
                        const certificationCost = calculateCertificationCost(state);
                        extraText.push(`\n\t\tCertification Cost: $${certificationCost}`);
                        const reconditioningCost = 400;
                        extraText.push(`\n\t\tReconditioning Cost: $${reconditioningCost}`);
                        const profit = 1500;
                        extraText.push(`\n\t\tProfit: $${profit}`);
                        const mimimumDifference = 1500;
                        extraText.push(`\n\t\tMinimum Differece: $${mimimumDifference}`);
                        extraText.push(`\n\n\n\t\t:::MMC OFFER CALCULATION:::`)
                        const totalCost = certificationCost + reconditioningCost + profit;
                        extraText.push(`\n\t\ttotalcost $${totalCost} = $${certificationCost} + $${reconditioningCost} + $${profit}`)
                        if(kbbPriceValue*1==0){
                            mmcOffer = retailValue - totalCost;
                            extraText.push(`\n\t\tAs kbb excellent price is 0, will get below cost $${totalCost} of retail value $${retailValue} = mmcoffer: $${mmcOffer}`);
                        }else{
                            let isLower = false;
                            let count = 0;
                            const maximumCalculation = 10;
                            mmcOffer = kbbPriceValue;
                            extraText.push(`\n\t\tkbb excellent price $${kbbPriceValue} + cost $${totalCost} = : $${kbbPriceValue+totalCost}`)
                            if(retailValue<kbbPriceValue+totalCost){
                                isLower = true
                                extraText.push(`\n\t\t retail value $${retailValue}< kbb excellent $${kbbPriceValue}+ totalcost $${totalCost} ($${kbbPriceValue+totalCost})`)
                                
                                extraText.push(`\n\t\t Mmc Offer is $${mmcOffer}`)
                            }
                            while(!isLower){
                                count++;
                                extraText.push(`\n\t\t retail value $${retailValue}> kbb excellent $${kbbPriceValue}+ totalcost $${totalCost} ($${kbbPriceValue+totalCost})`)
                                extraText.push(`lowering the offer from $${mmcOffer} to $${mmcOffer-500} `);
                                mmcOffer = mmcOffer-500;
                            }
                            extraText.push(`\n\t\tOffer should be: $${mmcOffer}`)
                            mmcOffer = Math.floor(mmcOffer/500)*500;
                            extraText.push(`\n\t\tNearest 500 value: $${mmcOffer}`)
                        }
                        if(mmcOffer+mimimumDifference > sellerPrice){
                            extraText.push(`\n\t\t mmcOffer $${mmcOffer} should have a differene of $${mimimumDifference} from asking price $${sellerPrice}`)
                            mmcOffer = sellerPrice - mimimumDifference;
                            extraText.push(`\n\t\t mmcOffer should be: $${mmcOffer} (seler price $${sellerPrice} - minimm difference $${mimimumDifference})`)
                        }
                        if(mmcOffer<=0){
                            return {
                                'updates': `-Manual- Program says mmc offer is zero or less${extraText.join('')}`,
                                'status': 'Manual',
                            };
                        }else if(sellerPrice-mmcOffer > maximumPriceDifferenece){
                            return {
                                'updates': `${getEstDate()}-PASS $- Seller asking 5k+ ($${sellerPrice})-AUTO\nPossible Offer will be $${mmcOffer} - $${mmcOffer+500}\n${url}\n${seriesSelected}${extraText.join('')}`,
                                'MMC Offer$': `${mmcOffer}`,
                                // 'KBB Fair$' : `${kbbFairPrice}`,
                                // 'KBB TIV' : `${kbbTradeValue}`,
                                'status': 'Pass $',
                                // 'Ave Mkt Price$': `${provisionPrice}`,
                                'JDP $': `${jdPriceValue}`,
                                // 'Ave $ MMR': `${mmrPriceValue}`,
                            }
                        }else{
                            return {
                                'updates': `${getEstDate()}-OFFER- ${mmcOffer}-${mmcOffer+500}-AUTO\nSeller asking ${sellerPrice}\n${url}\n${seriesSelected}${extraText.join('')}`,
                                'status': 'Initial Offer',
                                'MMC Offer$': `${mmcOffer}`,
                                // 'KBB Fair$' : `${kbbFairPrice}`,
                                // 'KBB TIV' : `${kbbTradeValue}`,
                                // 'Ave Mkt Price$': `${provisionPrice}`,
                                'JDP $': `${jdPriceValue}`,
                                // 'Ave $ MMR': `${mmrPriceValue}`,
                            }
                        }
                    }
                }else{
                    // throw new Error('Could not get values');
                    return {
                        'updates': `-Manual- Couldn't get values ALL NULL`,
                        'status': 'Manual',
                    };
                }
            };
            if(mondayItem.local.step=='suggestItem'){
                // https://mvs.laserappraiserservices.com/mvs/vehicleDetail?pageAction=vinNew&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175&vin=JTDKARFP3L3127584&mileage=42000'
                // console.log(mondayItem);
                const url = new URL(fixedData.urls.appraiseUrl);
                const currentUrl = window.location.href;
                url.searchParams.set('pageAction','vinNew');
                url.searchParams.set('deviceId',mondayItem.local.laserId);
                // transform vin to capital letter vin
                url.searchParams.set('vin', mondayItem.local.item.vin.toUpperCase());
                url.searchParams.set('mileage',mondayItem.local.item.mileage);
                if(currentUrl != url.href){
                    console.log(url.href);
                    window.location.href = url.href;
                }else{
                    // await sleep(5000);
                    const loginInput = document.querySelector("input#login");
                    const passwordInput = document.querySelector("input#password");
                    if(loginInput!=null || passwordInput!=null){
                        console.log(mondayItem)
                        const username = mondayItem.server.data.username;
                        const password = mondayItem.server.data.password;
                        simulateTextEntry(loginInput, username);
                        simulateTextEntry(passwordInput, password);
                        // submitButton.click();
                        console.log('program should have logged in by now');
                        return false;
                    }
                    // console.log(mondayItem);
                    // throw new Error('Something went wrong');
                    mondayItem.local.result = await appraisalResult(mondayItem.local.item);
                    if(mondayItem.server.delete){
                        // https://mvs.laserappraiserservices.com/mvs/vehicleList?pageAction=vinDelete&vin=JTDKARFP3L3127584&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175
                        const url = new URL(fixedData.urls.baseUrl);
                        url.searchParams.set('pageAction','vinDelete');
                        url.searchParams.set('vin', mondayItem.local.item.vin.toUpperCase());
                        url.searchParams.set('deviceId',mondayItem.local.laserId);
                        mondayItem.local.deleted = true;
                        await fetch(url.href);
                    }
                    mondayItem.local.step = 'final';
                    await mondayItemDB.SET(mondayItem);
                    await contentSetup('final');
                    return false;
                    // if()
                    
                    // kbb_trade_vgood_adj
                    // nada_retail_rtl_adj
                    
                    // const errorSection = document.querySelector('.ui-widget.eval-footer-message-widget');
                    // const errorSectionText = errorSection.innerText;
                    // if(errorSection!=null){
                    //     if(errorSectionText.includes(fixedData.errorNotices.sessionError)){
                    //         mondayItem.local.step = 'verifyAppraiser';
                    //         await mondayItemDB.SET(mondayItem);
                    //         const logoutButton = document.querySelector(`a[href="login?pageAction=logout"][title="Logout"]`);
                    //         logoutButton.click();
                    //         // await contentSetup('verifyAppraiser');
                    //         return false;
                    //     }
                    // }

                }
            }
        case 'final':
            mondayItem = await mondayItemDB.GET();
            if(mondayItem.local.step=='final'){
                const result = mondayItem.local.result;
                // console.log(result);
                // return;
                const isItemActiveOnChatData = await isItemActiveOnChat(`${(await mondayItemDB.GET()).id}`);
                if(isItemActiveOnChatData.status){
                    console.log('item belongs to chat');
                    if(result.status=='Initial Offer' || result.status=='Pass $'){
                        const newStatusesAfetrAutomatedMessage = {
                            'Initial Offer': 'MSG 1st Offer',
                            'Pass $': 'Told To Pass'
                        };
                        let messageCode  = '';
                        if(result.status=='Initial Offer'){
                            const localMondayItem = (await mondayItemDB.GET()).monday;
                            const item_price = localMondayItem['Price$'];
                            const mmc_price = result['MMC Offer$'];
                            console.log(`item price: ${item_price}`);
                            console.log(`mmc price: ${mmc_price}`);
                            if(item_price-mmc_price<2500){
                                messageCode = 'closeInitialOfferMessage';
                            }else{
                                messageCode = 'initialOfferMessage';
                            }
                        }else if(result.status=='Pass $'){
                            messageCode = 'pricePassMessage';
                        }
                        // change number into number with comma
                        // appraisalResult['MMC Offer$'] = appraisalResult['MMC Offer$'].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                        const setAutomatedOfferMessageResult = await setAutomatedOfferMessage({
                            item_id: `${(await mondayItemDB.GET()).monday.id}`,
                            messageCode: messageCode,
                            variables: {
                                '[[MMC_OFFER]]': `${result['MMC Offer$']}`.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                            }
                        });
                        console.log(setAutomatedOfferMessageResult);
                        result.status = newStatusesAfetrAutomatedMessage[result.status];
                        console.log('item belongs to chat and need auto offer message');
                    }else{
                        console.log('this item is from chat but do not need auto offer');
                    }
                }else{
                    console.log('this item is not from Chat');
                }
                await updateItemToMonday(result);
                await serverResponse({directory:'autovinAction',data:{
                    action: mondayItem.local.deleted?'deleted':'saved',
                    item_id: mondayItem.monday.id,
                    account_id: mondayItem.server.data.id,
                }});
                await mondayItemDB.SET(null);
                console.log('sleeping for 60 seconds');
                // 60 to 120 seconds
                const randomNumber = Math.floor(Math.random() * 60) + 60;
                await sleep(randomNumber*1000);
                window.location.href = fixedData.urls.baseUrl;
            }
        
    }
   

    



    // const currentUrl = window.location.href;
    // if(currentUrl.includes(fixedData.urls.logoutRedirectionUrl)){
    //     window.location.href = fixedData.urls.baseUrl;
    //     return false;
    // }
    // if(currentUrl.includes(fixedData.urls.baseUrl)){

    // }
    // if(pageByUrl()=='appraisal'){
    //     // 
    //     const mondayItemExits = await mondayItemDB.GET() != null;
    //     const consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
    //     if(!mondayItemExits){
            
    //         console.log('no item in local db');
    //         let newItem = await serverResponse({directory:'getNewItemId'});
    //         // while(true){
    //         if(newItem.action=='setDeviceId'){
    //             showDataOnConsole('setDeviceId');
    //             return false;
    //         }else if(newItem.action=='tryLaterAgain'){
    //             showDataOnConsole('waiting...');
    //             consoleBoard.style.backgroundColor = 'yellow';
    //             await sleep(300*1000);
    //             window.location.reload();
    //             return false;
    //         }else if(newItem.action=='workOnItem'){
    //             consoleBoard.style.backgroundColor = 'green';
    //             const item_id = newItem.item_id;
    //             await getSingleItemFromMonday(item_id);
    //         }else if(newItem.action=='collectNewItem'){
    //             // consoleBoard.style.backgroundColor = 'yellow';
    //             const item_ids = await getAutoVinIds();
    //             const response = await serverResponse({directory:'uploadNewItems',item_ids});
    //             await collectNewMessageFromChat();
    //             window.location.reload();
    //         }
    //             // await sleep(1000);
    //         // }
    //         // await getItemFromMonday();
    //         // console.log('item got from monday');
    //     }
    //     // 
    //     console.log(await mondayItemDB.GET());
    //     await sleep(5000);
    //     window.onbeforeunload=null; 
    //     const overlay = document.getElementById('walkme-overlay-all');
    //     if(overlay!=null){
    //         window.location.href=urls.appraisal;
    //     }
    //     // const mondayItemExits = await mondayItemDB.GET() != null;
    //     // if(!mondayItemExits){
    //     //     console.log('no item in local db');
    //     //     await getItemFromMonday();
    //     //     console.log('item got from monday');
    //     // }

        // const itemResult = await calculateMondayItemRawVin();
        // if(itemResult.suggest){
            
        //     console.log('item suggested');
        //     const markAsManual = document.createElement('button');
        //     markAsManual.innerText = 'Mark as Manual';
        //     const consoleBoard = document.getElementById(fixedData.workingSelectors.content.console);
        //     consoleBoard.append(markAsManual);
        //     markAsManual.addEventListener('click', async ()=>{
        //         await updateItemToMonday({
        //             'updates': `-Manual- Cannot Process`,
        //             'status': 'Manual',
        //         });
        //         document.getElementById('ext-gen74').click();
        //         await sleep(5000);
        //         await mondayItemDB.SET(null);
        //         window.location.reload();
        //     });
        //     let appraisalResult;
        //     try{
        //         appraisalResult =  await dynamicAppraisal(itemResult);
        //     }catch(e){
        //         console.log(e);
        //         consoleBoard.style.backgroundColor = 'red';
        //         return false;
        //     }
            
        //     console.log(appraisalResult);
        //     const isItemActiveOnChatData = await isItemActiveOnChat(`${(await mondayItemDB.GET()).id}`);
        //     if(isItemActiveOnChatData.status){
        //         console.log('item belongs to chat');
        //         if(appraisalResult.status=='Initial Offer' || appraisalResult.status=='Pass $'){
        //             const newStatusesAfetrAutomatedMessage = {
        //                 'Initial Offer': 'MSG 1st Offer',
        //                 'Pass $': 'Told To Pass'
        //             };
        //             let messageCode  = '';
        //             if(appraisalResult.status=='Initial Offer'){
        //                 const localMondayItem = (await mondayItemDB.GET()).monday;
        //                 const item_price = localMondayItem['Price$'];
        //                 const mmc_price = appraisalResult['MMC Offer$'];
        //                 console.log(`item price: ${item_price}`);
        //                 console.log(`mmc price: ${mmc_price}`);
        //                 if(item_price-mmc_price<2500){
        //                     messageCode = 'closeInitialOfferMessage';
        //                 }else{
        //                     messageCode = 'initialOfferMessage';
        //                 }
        //             }else if(appraisalResult.status=='Pass $'){
        //                 messageCode = 'pricePassMessage';
        //             }
        //             // change number into number with comma
        //             // appraisalResult['MMC Offer$'] = appraisalResult['MMC Offer$'].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        //             const setAutomatedOfferMessageResult = await setAutomatedOfferMessage({
        //                 item_id: `${(await mondayItemDB.GET()).monday.id}`,
        //                 messageCode: messageCode,
        //                 variables: {
        //                     '[[MMC_OFFER]]': `${appraisalResult['MMC Offer$']}`.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","),
        //                 }
        //             });
        //             console.log(setAutomatedOfferMessageResult);
        //             appraisalResult.status = newStatusesAfetrAutomatedMessage[appraisalResult.status];
        //             console.log('item belongs to chat and need auto offer message');
        //         }else{
        //             console.log('this item is from chat but do not need auto offer');
        //         }
        //     }else{
        //         console.log('this item is not from Chat');
        //     }
        //     // return null;
        //     // 
        //     await updateItemToMonday(appraisalResult);
        //     console.log('item updated');
            
        //     if(!(appraisalResult.status =='Invalid Vin' || appraisalResult.status =='Manual')){
        //         const appraisalPageActionButton = document.getElementById('ext-gen72');
        //         appraisalPageActionButton.click();
        //         await sleep(5000);
        //         const finalizeButton =  document.getElementById('finalizeButton');
        //         finalizeButton.click();
        //         await sleep(5000);
        //         document.querySelector('#create-inventory-dlg .x-toolbar-cell:nth-child(3) button').click();
        //         await sleep(10000);
        //     }

        // }else{
        //     console.log('item not suggested',itemResult);
        //     await updateItemToMonday(itemResult.data);
        // } 
    //     await mondayItemDB.SET(null);
    //     // await sleep(60000);
    //     window.onbeforeunload=null; 
    //     window.onbeforeunload=null; 
    //     window.location.href = urls.appraisal;





    //     // const appraisalResult =  await dynamicAppraisal({
    //     //     vin:'1C4HJXDG7JW167096',
    //     //     mileage: '78000',
    //     //     state: 'Ohio',
    //     //     sellerPrice: '20000',
    //     //     vehicle: 'Ford F-150 Pickup 4D 6 1/2 ft',
    //     //     series: null,
    //     //     url: 'https://www.facebook.com/marketplace/item/1046358649459974/'
    //     // });
    //     // console.log(appraisalResult);
    // }
};
const backgroundSetup = async () => {
    // const mondayItemDB = new ChromeStorage('mondayItem');
    // const mondayItemVinDB = new ChromeStorage('mondayItemVins');
    // const db = await mondayItemDB.GET();
    // console.log(db);
    // await mondayItemDB.SET(null);
    // await mondayItemVinDB.SET([]);
    // const db2 = await mondayItemDB.GET();
    // console.log(db2);
    // await carfaxResults('KNAFX4A64G5500818');
};
(async ()=>{
    if(typeof window=== 'undefined'){
        await backgroundSetup();
    }else{
        if(window.location.href.includes('chrome-extension')){
            await popupSetup();
        }else{
            await contentSetup();
        }
    }
})(); 
// console.log(window.location.href);


// fetch("https://mvs.laserappraiserservices.com/mvs/login", {
//   "body": "pageAction=login&login=JasonM63553&password=Ja673",
//   "method": "POST",
//   "mode": "cors",
//   "credentials": "omit"
// });
// https://mvs.laserappraiserservices.com/mvs/vehicleDetail?pageAction=vinNew&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175&vin=KMHLN4AJ5MU003662&mileage=10000


// (async()=>{
//     // delete
//     const response = await fetch('https://mvs.laserappraiserservices.com/mvs/vehicleList?pageAction=vinDelete&vin=JTDKARFP3L3127584&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175');
//     console.log(await response.text());
// })();

// (async()=>{
//     // create
// https://mvs.laserappraiserservices.com/mvs/vehicleList/?pageAction=vinNew&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175&vin=1C4RJFAG6LC144285&mileage=undefined
//     const response = await fetch('https://mvs.laserappraiserservices.com/mvs/vehicleDetail?pageAction=vinNew&deviceId=40F5AD23-510E-451F-A162-D56BC8B2D175&vin=JTDKARFP3L3127584&mileage=42000');
//     console.log(response.text());
// })();