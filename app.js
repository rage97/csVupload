// Import necessary modules
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const csv = require('csvtojson');
const path = require('path');
const fs = require('fs/promises');

// Create an instance of Express app
const app = express();
const port = 3000;

// Connect to MongoDB
mongoose.connect('mongodb://localhost/csvApp');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: function (req, file, cb) {
    // Set the filename to include the current timestamp and the original file extension
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Define Mongoose schema for CSV files
const csvSchema = new mongoose.Schema({
  filename: String,
  filepath: String,
});

// Create Mongoose model based on the schema
const CsvFile = mongoose.model('CsvFile', csvSchema);

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Enable parsing of URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Route to display the list of uploaded CSV files
app.get('/', async (req, res) => {
  try {
    // Retrieve all CSV files from the database
    const files = await CsvFile.find({}).exec();
    
    // Render the 'index' view with the list of files
    res.render('index', { files: files });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// Route to handle file uploads
app.post('/upload', upload.single('csvFile'), async (req, res) => {
  // Create a new instance of CsvFile with details from the uploaded file
  const newCsvFile = new CsvFile({
    filename: req.file.originalname,
    filepath: req.file.path,
  });

  try {
    // Save the new CSV file to the database
    await newCsvFile.save();
    
    // Redirect to the home page after successful upload
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// Route to display details of a specific CSV file
app.get('/csv/:id', async (req, res) => {
  try {
    // Find the CSV file by ID
    const file = await CsvFile.findById(req.params.id).exec();
    if (!file) {
      // If the file is not found, return a 404 error
      res.status(404).send('File not found');
      return;
    }

    // Parse the CSV file into JSON data
    const data = await csv().fromFile(file.filepath);

    let error = '';
    // Check if the data is valid
    if (!(Array.isArray(data) && data.length > 0)) {
      error = 'No valid data available in the CSV file.';
    }

    // Render the 'csvDetails' view with file details and data
    res.render('csvDetails', { filename: file.filename, data: data.slice(0, 100), error: error, file: file });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// Route to handle file deletion
app.post('/delete/:id', async (req, res) => {
  try {
    // Find and delete the CSV file by ID
    const file = await CsvFile.findOneAndDelete({ _id: req.params.id }).exec();
    if (!file) {
      // If the file is not found, return a 404 error
      res.status(404).send('File not found');
      return;
    }

    // Delete the file from the file system
    const filePath = file.filepath;
    await fs.unlink(filePath);
    
    // Redirect to the home page after successful deletion
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
