const appraisalResult = async (info) => {
    // let re
    const vin = info.vin;
    const mileage = info.mileage;
    const state = info.state;
    const sellerPrice = parseInt(info.sellerPrice);
    const vehicle = info.vehicle;
    const series = info.series;
    const url = info.url;

    await sleep(10000);
    const kbb = document.querySelector("#KBB")?.parentElement?.querySelectorAll('[data-key="AdjustedAdjustedexcellent"]')[1]
    const jd = document.querySelector("#NADA")?.parentElement?.querySelector('[data-key="AdjustedAdjustedretail"]');
    const kbbRetail = document.querySelector("#KBB")?.parentElement?.querySelector('[data-key="AdjustedAdjustedRetail"]');
    if (kbb != null || jd != null || kbbRetail != null) {

        let seriesSelected = '';
        if (vehicle) {

            // seriesSelected = await laserSeriesSelection();
            console.log('laser selection done')
        }
        let kbbPriceValue = parseInt(kbb?.textContent.replace(/[^\d]/g, "") || "0", 10);
        let jdPriceValue = parseInt(jd?.textContent.replace(/[^\d]/g, "") || "0", 10);;
        let kbbRetailValue = parseInt(kbbRetail?.textContent.replace(/[^\d]/g, "") || "0", 10);
        
        const extraText = [];
        extraText.push(`\n\tAppraisal Calculation:`);
        extraText.push(`\n\t\tJD POWER Value($${jdPriceValue})`);
        extraText.push(`\n\t\tKBB Trade Excellent TRADE($${kbbPriceValue}+$500= $${kbbPriceValue + 500})`);
        if (kbbPriceValue == 0 && jdPriceValue == 0) {
            return {
                'updates': `-Manual- Couldn't get any values \n${seriesSelected}`,
                'status': 'Manual',
            };
        }
        kbbPriceValue = kbbPriceValue + 500;
        extraText.push(`\n\t\tKBB Retail Adjusted Value($${kbbRetailValue})`);





        if (isNaN(kbbPriceValue) && isNaN(jdPriceValue) && isNaN(kbbRetailValue)) {
            // throw new Error('Could not get values');
            return {
                'updates': `-Manual- Couldn't get any values \n${seriesSelected}`,
                'status': 'Manual',
            };
        } else if (kbbPriceValue == 0 && jdPriceValue == 0 && kbbRetailValue == 0) {
            return {
                'updates': `-Manual- Couldn't get any values NAN \n${seriesSelected}`,
                'status': 'Manual',
            };
        } else {
            if (jdPriceValue * 1 == 0 && kbbRetailValue * 1 == 0) {
                return {
                    'updates': `-Manual- Program couldn't get jdPrice or kbb retail price${extraText.join('')}`,
                    'status': 'Manual',
                };
            } else {
                if (jdPriceValue * 1 == 0) {
                    jdPriceValue = kbbRetailValue;
                }
                if (kbbRetailValue * 1 == 0) {
                    kbbRetailValue = jdPriceValue;
                }
            }
            let mmcOffer = 0;
            const maximumPriceDifferenece = 5000;
            const retailValue = Math.min(jdPriceValue, kbbRetailValue)
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
            if (kbbPriceValue * 1 == 0) {
                mmcOffer = retailValue - totalCost;
                extraText.push(`\n\t\tAs kbb excellent TRADE is 0, will get below cost $${totalCost} of retail value $${retailValue} = mmcoffer: $${mmcOffer}`);
            } else {
                let isLower = false;
                let count = 0;
                const maximumCalculation = 30;
                mmcOffer = kbbPriceValue;
                extraText.push(`\n\t\tkbb excellent TRADE $${kbbPriceValue} + cost $${totalCost} = : $${kbbPriceValue + totalCost}`)
                if (retailValue > kbbPriceValue + totalCost) {
                    isLower = true
                    extraText.push(`\n\t\t retail value $${retailValue}> kbb excellent TRADE $${kbbPriceValue}+ totalcost $${totalCost} ($${kbbPriceValue + totalCost})`)

                    extraText.push(`\n\t\t Mmc Offer is $${mmcOffer}`)
                }
                while (!isLower) {
                    count++;
                    extraText.push(`\n\t\t retail value $${retailValue}> new offer $${kbbPriceValue}+ totalcost $${totalCost} ($${kbbPriceValue + totalCost})`)
                    extraText.push(`lowering the offer from $${mmcOffer} to $${mmcOffer - 500} `);
                    mmcOffer = mmcOffer - 500;
                    if (retailValue > mmcOffer + totalCost) {
                        isLower = true
                        extraText.push(`\n\t\t retail value $${retailValue}> new offer $${kbbPriceValue}+ totalcost $${totalCost} ($${kbbPriceValue + totalCost})`)

                        extraText.push(`\n\t\t Mmc Offer is $${mmcOffer}`)
                    }
                    if (count > maximumCalculation) {
                        return {
                            'updates': `-Manual- Program couldn't appraise`,
                            'status': 'Manual',
                        };
                    }
                }
                extraText.push(`\n\t\tOffer should be: $${mmcOffer}`)
                mmcOffer = Math.floor(mmcOffer / 500) * 500;
                extraText.push(`\n\t\tNearest 500 value: $${mmcOffer}`)
            }
            if (mmcOffer + mimimumDifference > sellerPrice) {
                extraText.push(`\n\t\t mmcOffer $${mmcOffer} should have a differene of $${mimimumDifference} from asking price $${sellerPrice}`)
                mmcOffer = sellerPrice - mimimumDifference;
                extraText.push(`\n\t\t mmcOffer should be: $${mmcOffer} (seler price $${sellerPrice} - minimm difference $${mimimumDifference})`)
            }
            if (mmcOffer <= 500) {
                return {
                    'updates': `-Manual- Program says mmc offer is 500 or less${extraText.join('')}`,
                    'status': 'Manual',
                };
            } else if (sellerPrice - mmcOffer > maximumPriceDifferenece) {
                return {
                    'updates': `${getEstDate()}-PASS $- Seller asking 5k+ ($${sellerPrice})-AUTO\nPossible Offer will be $${mmcOffer} - $${mmcOffer + 500}\n${url}\n${seriesSelected}${extraText.join('')}`,
                    'MMC Offer$': `${mmcOffer}`,
                    // 'KBB Fair$' : `${kbbFairPrice}`,
                    // 'KBB TIV' : `${kbbTradeValue}`,
                    'status': 'Pass $',
                    // 'Ave Mkt Price$': `${provisionPrice}`,
                    'JDP $': `${jdPriceValue}`,
                    // 'Ave $ MMR': `${mmrPriceValue}`,
                }
            } else {
                return {
                    'updates': `${getEstDate()}-OFFER- ${mmcOffer}-${mmcOffer + 500}-AUTO\nSeller asking ${sellerPrice}\n${url}\n${seriesSelected}${extraText.join('')}`,
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
    } else {
        // throw new Error('Could not get values');
        return {
            'updates': `-Manual- Couldn't get values ALL NULL`,
            'status': 'Manual',
        };
    }
};