const mongoose =  require("mongoose");

const recipeSchema = new mongoose.Schema(
	{
		name: String,
		description: String,

		course: String,
		cuisine: String,
		prep_time: String,
		cook_time: String,
		servings: String,

		reference: String,

		displayPhoto: String,

		categories: [String],	
		ingredients: [{ quantity: Number, ingredient: String }],
		instructions: [String],
	},
	{
		timestamps: true
	}
)

module.exports =  mongoose.model('Recipe', recipeSchema);
