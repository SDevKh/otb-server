import dotenv from 'dotenv';
dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

function extractFirstJSONBlock(text) {
  console.log('Raw AI Response:', text);
  
  // Clean the text by removing extra whitespace and invisible characters
  const cleanText = text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  
  // Try multiple extraction methods
  const extractionMethods = [
    // Method 1: Markdown code blocks
    () => {
      const markdownMatch = cleanText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
      return markdownMatch ? markdownMatch[1].trim() : null;
    },
    
    // Method 2: JSON objects (more lenient)
    () => {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      return jsonMatch ? jsonMatch[0] : null;
    },
    
    // Method 3: Find JSON between common delimiters
    () => {
      const patterns = [
        /```json\s*([\s\S]*?)\s*```/i,
        /```\s*([\s\S]*?)\s*```/i,
        /\{[\s\S]*\}/,
        /^\s*(\{[\s\S]*\})\s*$/
      ];
      
      for (const pattern of patterns) {
        const match = cleanText.match(pattern);
        if (match) {
          return match[1] || match[0];
        }
      }
      return null;
    },
    
    // Method 4: Try to extract from the entire response if it looks like JSON
    () => {
      if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
        return cleanText;
      }
      return null;
    }
  ];

  for (let i = 0; i < extractionMethods.length; i++) {
    try {
      const jsonStr = extractionMethods[i]();
      if (jsonStr) {
        console.log(`Trying extraction method ${i + 1}:`, jsonStr.substring(0, 200) + '...');
        
        // Clean the JSON string
        let cleanedJson = jsonStr
          .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove invisible characters
          .replace(/[ \t]+$/gm, '') // Remove trailing spaces
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .trim();
        
        const parsed = JSON.parse(cleanedJson);
        console.log('Successfully parsed JSON with method', i + 1);
        return parsed;
      }
    } catch (err) {
      console.error(`Extraction method ${i + 1} failed:`, err.message);
    }
  }

  throw new Error('No valid JSON block found in the response');
}

async function callGroqAI(prompt, systemPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  const maxRetries = 3;
  const retryDelayMs = 1000;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not set');
  }

  const body = {
    model: 'llama3-70b-8192', // Use a more capable model
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7, // Add some creativity while maintaining consistency
    max_tokens: 4000, // Ensure enough tokens for full response
    stream: false
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} - Calling Groq AI...`);
      
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Groq API error: ${response.status} - ${errorText}`);
        throw new Error(`Groq API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Groq API Response:', JSON.stringify(data, null, 2));

      if (!data.choices || data.choices.length === 0) {
        throw new Error('Groq API returned no choices');
      }

      const content = data.choices[0].message.content;
      console.log('AI Response Content:', content);
      
      return content;
    } catch (error) {
      console.error(`Attempt ${attempt} to call Groq AI failed:`, error.message);
      if (attempt === maxRetries) {
        throw new Error(`Failed to call Groq AI after ${maxRetries} attempts: ${error.message}`);
      }
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function generateAIPersonalityAnalysis(data) {
  // Add a unique identifier to make each request different
  const sessionId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  const prompt = `
    Session ID: ${sessionId}
    
    Analyze this person's personality based on their detailed questionnaire responses and provide a deeply personalized, unique, and insightful personality analysis that is tailored specifically to this individual.

    **Questionnaire Data:**
    - Energy Style: ${data.personality.energy} (How they recharge and interact)
    - Planning Style: ${data.personality.planning} (How they approach tasks and deadlines)
    - Learning Style: ${data.learningStyle} (How they process information best)
    - Energy Pattern: ${data.energyPattern} (When they feel most alert and productive)
    - Pressure Handling: ${data.pressureHandling} (How they respond to high-pressure situations)
    - Focus Breakers: ${data.focusBreakers.join(', ')} (What typically breaks their concentration)
    - Current Struggles: ${data.struggles.join(', ')} (Challenges they're currently facing)
    - Main Goal: "${data.goals}" (What they want to achieve)

    Create a detailed, personalized analysis that feels like you truly understand this individual. Make it unique and specific to their combination of traits.

    Please provide:
    1. A creative personality type name (not generic)
    2. A detailed personal description (3-4 sentences)
    3. 6-8 specific strengths
    4. 4-5 realistic challenges
    5. Optimal working style description
    6. 4-5 specific motivation drivers

    CRITICAL: Respond with ONLY a JSON object in this exact format:
    {
      "personalityType": "string",
      "description": "string", 
      "strengths": ["string1", "string2", "string3", "string4", "string5", "string6"],
      "challenges": ["string1", "string2", "string3", "string4"],
      "workingStyle": "string",
      "motivationDrivers": ["string1", "string2", "string3", "string4"]
    }
  `;

  const systemPrompt = `You are an expert personality analyst. Create unique, personalized analyses that feel deeply insightful and specific to each individual. Never use generic personality types or advice.

IMPORTANT INSTRUCTIONS:
1. Always respond with ONLY valid JSON - no other text, explanations, or markdown
2. Ensure the JSON is properly formatted with correct quotes and commas
3. Make each analysis unique and personal
4. Base everything on the specific data provided
5. Do not use common personality type names like "INTJ" or "Type A"`;

  try {
    console.log('Generating personality analysis...');
    const response = await callGroqAI(prompt, systemPrompt);
    
    const parsed = extractFirstJSONBlock(response);
    console.log('Parsed personality analysis:', parsed);

    // Validate the parsed response
    if (!parsed.personalityType || !parsed.description) {
      throw new Error('Invalid response structure from AI');
    }

    return {
      personalityType: parsed.personalityType,
      description: parsed.description,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : ['Determined', 'Goal-oriented', 'Adaptable'],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : ['May need structure', 'Could benefit from accountability'],
      workingStyle: parsed.workingStyle || 'Flexible and adaptive approach',
      motivationDrivers: Array.isArray(parsed.motivationDrivers) ? parsed.motivationDrivers : ['Personal growth', 'Achievement'],
    };
  } catch (error) {
    console.error('Error generating AI personality analysis:', error);
    console.log('Falling back to fallback analysis...');
    return generateFallbackPersonalityAnalysis(data);
  }
}

export async function generateAISuccessStrategy(data, personality) {
  const sessionId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  const prompt = `
    Session ID: ${sessionId}
    
    Create a comprehensive, highly personalized success strategy for this specific person:

    **Their Personality:**
    - Type: ${personality.personalityType}
    - Description: ${personality.description}
    - Working Style: ${personality.workingStyle}
    - Strengths: ${personality.strengths.join(', ')}
    - Challenges: ${personality.challenges.join(', ')}
    - Motivation Drivers: ${personality.motivationDrivers.join(', ')}

    **Their Specific Situation:**
    - Energy Style: ${data.personality.energy}
    - Planning Style: ${data.personality.planning}
    - Learning Style: ${data.learningStyle}
    - Energy Pattern: ${data.energyPattern}
    - Pressure Handling: ${data.pressureHandling}
    - Focus Breakers: ${data.focusBreakers.join(', ')}
    - Current Struggles: ${data.struggles.join(', ')}
    - Specific Goal: "${data.goals}"

    Create a personalized strategy that addresses their unique situation and goal.

    CRITICAL: Respond with ONLY a JSON object in this exact format:
    {
      "productivityMethod": "string",
      "dailyRoutine": "string",
      "learningApproach": ["string1", "string2", "string3", "string4", "string5"],
      "habitFormation": ["string1", "string2", "string3", "string4", "string5"],
      "motivationTechniques": ["string1", "string2", "string3", "string4"],
      "focusStrategies": ["string1", "string2", "string3", "string4", "string5"],
      "pressureManagement": ["string1", "string2", "string3", "string4"],
      "goalAchievementPlan": ["string1", "string2", "string3", "string4", "string5", "string6"],
      "weeklyBlueprint": {
        "week1": ["string1", "string2", "string3"],
        "week2": ["string1", "string2", "string3"],
        "week3": ["string1", "string2", "string3"],
        "week4": ["string1", "string2", "string3"]
      },
      "bonusTips": ["string1", "string2", "string3", "string4", "string5"]
    }
  `;

  const systemPrompt = `You are an expert success strategist. Create highly personalized, actionable strategies based on individual personality types and specific goals. Make everything specific and tailored - no generic advice.

IMPORTANT INSTRUCTIONS:
1. Always respond with ONLY valid JSON - no other text, explanations, or markdown
2. Ensure the JSON is properly formatted with correct quotes and commas
3. Make each strategy unique and personal to the individual
4. Base everything on their specific personality and goal
5. Provide actionable, specific advice`;

  try {
    console.log('Generating success strategy...');
    const response = await callGroqAI(prompt, systemPrompt);
    
    const parsed = extractFirstJSONBlock(response);
    console.log('Parsed success strategy:', parsed);

    // Validate the parsed response
    if (!parsed.productivityMethod || !parsed.dailyRoutine) {
      throw new Error('Invalid response structure from AI');
    }

    return {
      productivityMethod: parsed.productivityMethod,
      dailyRoutine: parsed.dailyRoutine,
      learningApproach: Array.isArray(parsed.learningApproach) ? parsed.learningApproach : ['Active learning', 'Regular practice'],
      habitFormation: Array.isArray(parsed.habitFormation) ? parsed.habitFormation : ['Start small', 'Build consistency'],
      motivationTechniques: Array.isArray(parsed.motivationTechniques) ? parsed.motivationTechniques : ['Track progress', 'Celebrate wins'],
      focusStrategies: Array.isArray(parsed.focusStrategies) ? parsed.focusStrategies : ['Minimize distractions', 'Use focus blocks'],
      pressureManagement: Array.isArray(parsed.pressureManagement) ? parsed.pressureManagement : ['Break tasks down', 'Manage stress'],
      goalAchievementPlan: Array.isArray(parsed.goalAchievementPlan) ? parsed.goalAchievementPlan : ['Set milestones', 'Track progress'],
      weeklyBlueprint: parsed.weeklyBlueprint && typeof parsed.weeklyBlueprint === 'object' ? parsed.weeklyBlueprint : {
        week1: ['Foundation building', 'Habit establishment'],
        week2: ['Momentum building', 'Skill development'],
        week3: ['Optimization', 'Fine-tuning'],
        week4: ['Mastery', 'Evaluation']
      },
      bonusTips: Array.isArray(parsed.bonusTips) ? parsed.bonusTips : ['Stay consistent', 'Be patient with progress']
    };
  } catch (error) {
    console.error('Error generating AI success strategy:', error);
    console.log('Falling back to fallback strategy...');
    return generateFallbackSuccessStrategy(data, personality);
  }
}

// Enhanced fallback functions with more variety
function generateFallbackPersonalityAnalysis(data) {
  console.log('Using fallback personality analysis');
  
  // Create some variety in fallback responses
  const variants = [
    {
      personalityType: 'The Strategic Achiever',
      description: 'You approach goals with careful planning and persistent effort, adapting your strategies based on what works best for your unique situation.',
      workingStyle: 'Methodical and thoughtful with bursts of focused energy'
    },
    {
      personalityType: 'The Adaptive Learner',
      description: 'You have a flexible approach to growth and learning, constantly adjusting your methods to find what resonates with your personal style.',
      workingStyle: 'Flexible and responsive to changing circumstances'
    },
    {
      personalityType: 'The Focused Innovator',
      description: 'You combine structured thinking with creative problem-solving, finding unique ways to achieve your objectives.',
      workingStyle: 'Balanced between structure and creativity'
    }
  ];
  
  // Select variant based on data to create some consistency
  const variantIndex = (data.goals.length + data.struggles.length) % variants.length;
  const variant = variants[variantIndex];

  const strengths = ['Goal-oriented mindset', 'Willingness to learn and grow'];
  const challenges = ['Finding the right balance', 'Maintaining consistency'];

  // Add personality-specific traits
  if (data.personality.energy === 'introvert') {
    strengths.push('Deep focus capabilities', 'Thoughtful analysis');
  } else {
    strengths.push('Collaborative energy', 'Communication skills');
  }

  if (data.personality.planning === 'planner') {
    strengths.push('Organizational skills', 'Strategic thinking');
  } else {
    strengths.push('Adaptability', 'Creative problem-solving');
  }

  return {
    personalityType: variant.personalityType,
    description: variant.description,
    strengths,
    challenges,
    workingStyle: variant.workingStyle,
    motivationDrivers: ['Achievement', 'Personal growth', 'Mastery', 'Progress']
  };
}

function generateFallbackSuccessStrategy(data, personality) {
  console.log('Using fallback success strategy');
  
  return {
    productivityMethod: `${data.personality.planning === 'planner' ? 'Structured' : 'Flexible'} Focus Method`,
    dailyRoutine: `${data.energyPattern} focused work sessions with regular breaks and reflection`,
    learningApproach: ['Active engagement', 'Regular practice', 'Consistent review', 'Practical application', 'Feedback integration'],
    habitFormation: ['Start with micro-habits', 'Build consistency', 'Track progress', 'Celebrate small wins', 'Adjust as needed'],
    motivationTechniques: ['Set clear milestones', 'Visualize success', 'Track achievements', 'Connect to purpose'],
    focusStrategies: ['Minimize distractions', 'Time-blocking', 'Environment design', 'Energy management', 'Regular breaks'],
    pressureManagement: ['Break tasks down', 'Breathing techniques', 'Preparation strategies', 'Support systems'],
    goalAchievementPlan: ['Define clear objectives', 'Create action steps', 'Set deadlines', 'Monitor progress', 'Adjust strategies', 'Celebrate milestones'],
    weeklyBlueprint: {
      week1: ['Foundation setup', 'System creation', 'Initial habits'],
      week2: ['Momentum building', 'Skill development', 'Routine optimization'],
      week3: ['Progress acceleration', 'Challenge addressing', 'Strategy refinement'],
      week4: ['Mastery focus', 'Evaluation', 'Future planning']
    },
    bonusTips: ['Consistency over perfection', 'Adjust strategies regularly', 'Celebrate progress', 'Learn from setbacks', 'Stay patient with growth']
  };
}