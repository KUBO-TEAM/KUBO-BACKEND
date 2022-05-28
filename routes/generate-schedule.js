const express = require('express');
const Recipe = require('../models/recipe.model');
const moment = require('moment');

const router = express.Router();

router.post('/',

async function generateSchedule(req, res){
    const { categories, clientCurrentTime } = req.body;

    const categoriesArrayJson = categories;
    
    const categoriesNames = []; 

    for(let i = 0; i < categoriesArrayJson.length; i++){
        categoriesNames.push(categoriesArrayJson[i].name);
    }

    const recipes = await Recipe.find({ categories: { "$in" : categoriesNames} });

    const recipeSchedules = [];

    const daysToSchedule = 3;
    const time = [
        {
            'hours' :  13,
            'minutes' : 0,
        },
        {
            'hours' :  19,
            'minutes' : 0,
        }
    ];

    const originalClientTime = moment(clientCurrentTime);
    const incrementalTime = moment(clientCurrentTime);
    const createdAt = moment();
    
    let recipeCounter = 0;

    for(let i = 0; i < daysToSchedule; i++){

        for(let x = 0; x < time.length; x++){

            if(recipeCounter >= recipes.length){
                break;
            }

            incrementalTime.set(time[x]);

            if(incrementalTime.isAfter(originalClientTime)){

                const recipeSchedule = {
                    recipe : recipes[recipeCounter],
                    start : incrementalTime.add(1, 'hours').format(),
                    end : incrementalTime.add(1, 'hours').format(),
                    createdAt : createdAt.format(),
                }; 

                recipeSchedules.push(recipeSchedule);
                recipeCounter++;
            }
        }



        incrementalTime.add(1, 'days');
    }



    res.send({
        message:'Successfully generate schedule!',
        data: recipeSchedules,
    });
}

);

module.exports = router;