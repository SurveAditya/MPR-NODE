const jwt = require("jsonwebtoken");
const router = require("express").Router();
const User = require("../models/User");
const config = require("../config");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const isUser = require("../middlewares/isUser");
const OpenAI = require('openai');
const axios = require('axios');


const openai = new OpenAI({
    apiKey: config.openai,
  });

//   Give me a job title and job description which might be there on this link,\n${url}
const getTitleAndDescription = async (url) => {
    try {
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{"role": "user", "content": `Give me a job title and job description which might be there on this link,\n${url} the format of your output should be like
            Job Title: Accessibility Software Engineer
            
            Job Description:
            As an Accessibility Software Engineer, you will play a crucial role in designing, implementing, and testing software applications to ensure they are accessible to individuals with disabilities. Collaborating with cross-functional teams, you will identify and address accessibility barriers, conduct usability assessments, and implement solutions to enhance the overall user experience. Your responsibilities will include coding, testing, and debugging software features with a focus on accessibility standards and guidelines. Additionally, you will work closely with stakeholders to raise awareness about accessibility best practices and contribute to creating a more inclusive digital environment. This position offers a unique opportunity to make a meaningful impact by championing accessibility in software development within the vibrant tech landscape of India.`}],
            max_tokens: 100,
        });
  
      const generatedText = chatCompletion.choices[0].message.content.trim();
      console.log(generatedText);
      const [jobTitle, jobDescription] = generatedText.split('\n\n');
  
      return { jobTitle, jobDescription };
    } catch (error) {
      console.error(error);
      return { error: 'Failed to generate title and description' };
    }
  };

router.post("/userregister", async (req, res) => {
    const { name, age, disability, email, password, confirmPassword } = req.body;
	const admin=false;

    if (!name || !age || !disability || !email || !password || !confirmPassword) {
        return res.status(400).send("One or more of the fields are missing.");
    }

    // Checking for multiple accounts for a single email
    const emailCheck = await User.findOne({ email: email });
    if (emailCheck) {
        return res.status(400).send("Only one account per email address is allowed");
    }

    if (password !== confirmPassword) {
        return res.status(400).send("Password and Confirm Password do not match");
    }

    // Hashing the password
    bcrypt.hash(password, saltRounds, async function (err, hash) {
        if (err) {
            return res.status(500).send("Error hashing the password");
        }

        // Create a new user
        const newUser = new User({ name, age, disability, email, password: hash,admin });
        try {
            const savedUser = await newUser.save();
            return res.json(savedUser);
        } catch (error) {
            return res.status(500).send("Error saving the user");
        }
    });
});

router.post("/userlogin", async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password)
		return res.status(400).send("Missing email or password");

	// checking if email exists
	const emails = await User.find({ email: email });
	if (emails.length === 0) return res.status(400).send("Email is incorrect");

	const user = emails[0];

	bcrypt.compare(password, user.password, async function(err, result) {
		if(result==false) return res.status(400).send("Incorrect password");

		// sending token
		const token =jwt.sign(
		{
			id: user._id,
		},
		config.jwtSecret,{expiresIn:"1d"}
		);
		res.setHeader("token", token);
		const name=user.name;
		res.json({ token,name });
	});
});


router.post("/jobs", async (req, res) => {
    const userKeyword = req.body.keyword;
    console.log(userKeyword);
  
    const options = {
      method: 'POST',
      url: 'https://all-serp.p.rapidapi.com/all-serp-website',
      params: {
        keyword: `Jobs for people with disabilities in India in the field of ${userKeyword}`,
        location: 'us',
        language: 'en',
        search_engine: 'google',
        page_limit: '1',
        search_type: 'All'
      },
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': config.rapid,
        'X-RapidAPI-Host': 'all-serp.p.rapidapi.com'
      },
      data: {
        key1: 'value',
        key2: 'value'
      }
    };
  
    try {
      const response = await axios.request(options);
  
      // Extract job URLs from local_results
      const jobUrls = response.data.local_results.map(result => result.url_search);
      const jobsInfo = await Promise.all(
        jobUrls.map(async (url) => {
          const { jobTitle, jobDescription, error } = await getTitleAndDescription(url);
          return { url, jobTitle, jobDescription, error };
        })
      );
  
      res.json({ jobsInfo });
     
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });



  

module.exports = router;
