const express = require('express');
const Recipe = require('../models/recipe.model');
const { verifyAdmin, verifyUserToken } = require('../helpers/validators');
const { check, validationResult } = require('express-validator');
const {format} = require('util');
const fs = require('fs');
const { recipeUpload, recipeBucket } = require('../helpers/recipe-storage');
const { notify } = require('../helpers/notification');


const router = express.Router();

/** Get latest recipe */
router.get('/get-latest-recipe', 

async function getLatestRecipe(req, res){

  const recipe = await  await Recipe.findOne().sort({createdAt: -1});

  res.send({
    message:'Successfully fetch latest recipe',
    data: recipe,
  });
}

);
/** Get all the recipes */
router.get('/',

async function getAllRecipe(req, res){

  const recipes = await Recipe.find({}).sort({createdAt: -1});

  if(recipes){

    res.status(200).send({
      message: 'Successfully fetch recipes!',
      data: recipes,
    });

  }else{

    res.status(400).send({
      message: 'Cannot fetch recipes',
    });

  }

}

);

/** Filter recipe by category */
router.post('/filter',

async function filterByIngredients(req, res){
  const {body} = req;
  
  const categoriesArrayJson = body.categories;

  const categoriesNames = []; 

  for(let i = 0; i < categoriesArrayJson.length; i++){
    categoriesNames.push(categoriesArrayJson[i].name);
  }

  const recipes = await Recipe.find({ categories: { "$in" : categoriesNames} });
  
  res.send({
    message: 'Successfully filter recipe!',
    data: recipes
  })

},

);

/** Get single recipe */
router.get('/:id',

async function getRecipe(req, res){

  const _id = req.params.id;

  const recipe = await Recipe.findById(_id);

  if(recipe){

    res.send({
      message: 'Successfully fetch recipe!',
      data: recipe,
    });

  }else{

    res.status(401).send({
      message: 'Cannot fetch recipe'
    });
  }
  
}

);

/** Add Recipe */
router.post('/', 

/** Upload to this backend */
recipeUpload.single('displayPhoto'),

/** Validations */
check('name').not().isEmpty(),
check('description').not().isEmpty(),
check('reference').not().isEmpty(),
check('prep_time').not().isEmpty(),
check('cook_time').not().isEmpty(),

check('categories').not().isEmpty(),
check('ingredients').not().isEmpty(),
check('instructions').not().isEmpty(),

(req, res, next) => {
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    res.status(400).send({
      message: errors.array(),
    });
  }else{
    next();
  }
},

/** Validations */
verifyUserToken,
verifyAdmin,

async function uploadToCloud(req, res, next){

  if(recipeBucket){
    const blob = recipeBucket.file(Date.now() + '.png');
    const blobStream = blob.createWriteStream();  
    
    blobStream.on('error', err => {
      console.log(err);
    });
  
    blobStream.on('finish', () => {
      // The public URL can be used to directly access the file via HTTP.
      const publicUrl = format(
        `https://storage.googleapis.com/${recipeBucket.name}/${blob.name}`
      );
  
      req.fileUrl = publicUrl;
  
      next();
    });
  
    blobStream.end(req.file.buffer);
  }else{
   req.fileUrl = `${req.protocol}://${req.get('host')}/images/recipes/${req.file.filename}`;
   next();
  }
},

async function createRecipe(req, res){

	const body = req.body;
  const { course, cuisine, servings} = body;

	const newRecipe = new Recipe({
    ...body,

    course: course ? course : undefined,
    cuisine: cuisine ? cuisine : undefined,
    servings: servings? servings  : undefined,

		ingredients: JSON.parse(body.ingredients),
		instructions: JSON.parse(body.instructions),
		categories: JSON.parse(body.categories),
		displayPhoto: req.fileUrl,
	});

	const createdRecipe = await newRecipe.save();

  await notify({
    title: 'New recipe is added!',
    message: `${createdRecipe.name}`,
    recipe_id: createdRecipe._id,
  });

	res.send({
		message: 'Successfully upload image!',
		data: createdRecipe,
	});

}

);

/** Remove a recipe */
router.delete('/:id',

/** Validations */
verifyUserToken,
verifyAdmin,

async function deleteRecipe(req, res){
  const { id } = req.params;

  const recipe = await Recipe.findByIdAndDelete(id);
  if(recipe){
    const fileName = recipe.displayPhoto.substring(recipe.displayPhoto.lastIndexOf('/') + 1 );
    const displayPhoto = `public/images/recipes/${fileName}`;

    if(recipeBucket){
      const file = recipeBucket.file(fileName);

      file.exists().then(function(data) {
          recipeBucket.file(fileName).delete();
      });

    }else{
      fs.stat(displayPhoto, function(err, stat){
        if(err === null){
          fs.unlinkSync(displayPhoto);
        }
      });
    }

    await notify({
      title: 'We delete this recipe',
      message: `${recipe.name} has been deleted.`,
      recipe_id: recipe._id,
    });

    res.send({
      message: 'Delete successfully',
    })

  }else{
    res.status(401).send({
      message: 'Delete unsuccessful',
    })
  }
},

);

/** Update recipe */
router.put('/:id',

/** Upload to this backend */
recipeUpload.single('displayPhoto'),

/** Validations */
check('name').not().isEmpty(),
check('description').not().isEmpty(),
check('reference').not().isEmpty(),
check('prep_time').not().isEmpty(),
check('cook_time').not().isEmpty(),

check('categories').not().isEmpty(),
check('ingredients').not().isEmpty(),
check('instructions').not().isEmpty(),

(req, res, next) => {
  const errors = validationResult(req);

  if(!errors.isEmpty()){
    res.status(400).send({
      message: errors.array(),
    })
  }else{
    next();
  }
},

verifyUserToken,
verifyAdmin,

async function updateRecipe(req, res, next){
  const { id } = req.params;

  const recipe = await Recipe.findOneAndUpdate({
    _id: id,
  },{
    ...req.body,

    categories: JSON.parse(req.body.categories),
    ingredients: JSON.parse(req.body.ingredients),
    instructions: JSON.parse(req.body.instructions),

  });

  if(recipe){
    req.recipe = recipe;
    
    await notify({
      title: 'A recipe has been updated',
      message: `${recipe.name}`,
      recipe_id: recipe._id,
    });

    next();
  }else{
    res.status(400).send({
      message: 'Unable to update the recipe',
    })
  }
},

async function deleteRecipeImage(req, res){
  const { recipe } = req;
  if(req.file){
    const fileName = recipe.displayPhoto.substring(recipe.displayPhoto.lastIndexOf('/') + 1 );
    const displayPhoto = `public/images/recipes/${fileName}`;

    if(recipeBucket){
      recipeBucket.file(fileName).delete();
      
      const blob = recipeBucket.file(Date.now() + '.png');
      const blobStream = blob.createWriteStream();
      
      blobStream.on('error', err => {
        res.status(4001).send({
          message: 'Error Uploading to cloud'
        });
      });
    
      blobStream.on('finish', async () => {
        // The public URL can be used to directly access the file via HTTP.
        const publicUrl = format(
          `https://storage.googleapis.com/${recipeBucket.name}/${blob.name}`
        );
    
        req.recipe.displayPhoto = publicUrl;
        await req.recipe.save();
    
        res.send({
          message: 'Successfully update user'
        });

      });
    
      blobStream.end(req.file.buffer);
      
    }else{
      fs.stat(displayPhoto, async function(err, stat){
        if(err === null){
          fs.unlinkSync(displayPhoto);
          const newDisplayPhoto = `${req.protocol}://${req.get('host')}/images/recipes/${req.file.filename}`;
          req.recipe.displayPhoto = newDisplayPhoto;
          await req.recipe.save();
        }
      });
      
      res.send({
        message: 'Successfully update user'
      });

    }

  }else{
    res.send({
      message: 'Successfully update user'
    });
  }


}

);

module.exports = router;