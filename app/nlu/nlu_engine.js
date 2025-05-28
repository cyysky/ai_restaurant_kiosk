const EventEmitter = require('events');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs').promises;

class NLUEngine extends EventEmitter {
    constructor(llmConfig, nluConfig) {
        super();
        this.llmConfig = llmConfig;
        this.nluConfig = nluConfig;
        this.openai = null;
        this.promptTemplates = {};
        this.conversationHistory = [];
        this.isInitialized = false;
        this.fallbackPatterns = new Map();
    }

    async initialize() {
        console.log('Initializing NLU Engine with Gemma 3:4B...');
        
        try {
            // Initialize OpenAI-compatible client for local Gemma 3:4B
            this.openai = new OpenAI({
                baseURL: this.llmConfig.baseURL || 'http://localhost:11434/v1',
                apiKey: 'local-key' // Not used for local inference but required by client
            });
            
            // Load prompt templates
            await this.loadPromptTemplates();
            
            // Initialize fallback patterns
            this.initializeFallbackPatterns();
            
            // Test connection to local LLM
            await this.testConnection();
            
            this.isInitialized = true;
            console.log('NLU Engine initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize NLU Engine:', error);
            console.log('Falling back to pattern matching only');
            this.isInitialized = false;
        }
    }

    async loadPromptTemplates() {
        try {
            // Default prompt templates (will be overridden by config files if available)
            this.promptTemplates = {
                system: `You are an AI assistant for a restaurant kiosk. Your job is to understand customer requests and extract:
1. Intent (what they want to do)
2. Entities (specific items, quantities, etc.)

Always respond in JSON format with: {"intent": "intent_name", "entities": {...}, "confidence": 0.0-1.0}

Available intents:
- greeting: Customer says hello or starts conversation
- browse_menu: Customer wants to see menu or category
- add_item: Customer wants to add item to cart
- remove_item: Customer wants to remove item from cart
- view_cart: Customer wants to see their cart
- checkout: Customer wants to complete order
- help: Customer needs assistance
- goodbye: Customer is leaving

Available menu categories:
- appetizers: Appetizers (starters, salads, wings)
- mains: Main Courses (burgers, pasta, salmon, entrees)
- beverages: Beverages (drinks, sodas, juices, coffee)
- desserts: Desserts (cakes, pies, sweets)

For browse_menu intent, map user requests to these categories:
- "chicken" or "meat" requests → use "chicken" as category (system will search for chicken items)
- "starters" or "apps" → use "appetizers"
- "entrees" or "dinner" → use "mains"
- "drinks" or "soda" → use "beverages"
- "sweets" or "cake" → use "desserts"

Extract entities like: item_name, quantity, category, modifications, etc.`,

                intent: `Analyze this customer input and determine their intent and extract entities.
Customer said: "{input}"
Context: {context}

Respond with JSON only:`,

                entity: `Extract specific entities from this restaurant order:
Input: "{input}"
Extract: item names, quantities, categories, modifications, preferences
JSON format only:`
            };
            
            console.log('Prompt templates loaded');
            
        } catch (error) {
            console.error('Failed to load prompt templates:', error);
        }
    }

    initializeFallbackPatterns() {
        // Pattern-based fallback for when LLM is unavailable
        this.fallbackPatterns.set(/^(hi|hello|hey|good morning|good afternoon|good evening)/i, {
            intent: 'greeting',
            entities: {},
            confidence: 0.9
        });
        
        this.fallbackPatterns.set(/^(bye|goodbye|see you|thanks|thank you)/i, {
            intent: 'goodbye',
            entities: {},
            confidence: 0.9
        });
        
        this.fallbackPatterns.set(/(menu|categories|what do you have|show me)/i, {
            intent: 'browse_menu',
            entities: {},
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(cart|order|what's in my)/i, {
            intent: 'view_cart',
            entities: {},
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(checkout|pay|complete|finish|done)/i, {
            intent: 'checkout',
            entities: {},
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(help|assist|support|don't understand)/i, {
            intent: 'help',
            entities: {},
            confidence: 0.8
        });
        
        // Item addition patterns
        this.fallbackPatterns.set(/(add|want|order|get me|i'll have|i'd like).*(\d+)?/i, {
            intent: 'add_item',
            entities: {},
            confidence: 0.7
        });
        
        // Category patterns
        this.fallbackPatterns.set(/(appetizer|starter|salad)/i, {
            intent: 'browse_menu',
            entities: { category: 'appetizers' },
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(main|entree|dinner|lunch)/i, {
            intent: 'browse_menu',
            entities: { category: 'mains' },
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(drink|beverage|soda|juice|water)/i, {
            intent: 'browse_menu',
            entities: { category: 'beverages' },
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(dessert|sweet|cake|pie)/i, {
            intent: 'browse_menu',
            entities: { category: 'desserts' },
            confidence: 0.8
        });
        
        // Protein/ingredient-based patterns
        this.fallbackPatterns.set(/(chicken|chickens)/i, {
            intent: 'browse_menu',
            entities: { category: 'chicken' },
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(beef|meat|protein)/i, {
            intent: 'browse_menu',
            entities: { category: 'beef' },
            confidence: 0.8
        });
        
        this.fallbackPatterns.set(/(fish|salmon|seafood)/i, {
            intent: 'browse_menu',
            entities: { category: 'fish' },
            confidence: 0.8
        });
    }

    async testConnection() {
        try {
            console.log('Testing connection to Gemma 3:4B...');
            
            const response = await this.openai.chat.completions.create({
                model: this.llmConfig.model || 'gemma3:4b',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a test. Respond with just "OK".'
                    },
                    {
                        role: 'user',
                        content: 'Test connection'
                    }
                ],
                max_tokens: 10,
                temperature: 0.1
            });
            
            console.log('Gemma 3:4B connection successful');
            return true;
            
        } catch (error) {
            console.error('Failed to connect to Gemma 3:4B:', error.message);
            throw error;
        }
    }

    async processText(text) {
        console.log('Processing text with NLU:', text);
        
        try {
            // Try LLM-based processing first
            if (this.isInitialized) {
                const result = await this.processWithLLM(text);
                if (result && result.confidence >= this.nluConfig.confidenceThreshold) {
                    this.addToHistory(text, result);
                    this.emit('intent-recognized', result);
                    return result;
                }
            }
            
            // Fallback to pattern matching
            console.log('Using fallback pattern matching');
            const fallbackResult = this.processWithPatterns(text);
            this.emit('intent-recognized', fallbackResult);
            return fallbackResult;
            
        } catch (error) {
            console.error('NLU processing error:', error);
            this.emit('nlu-error', error);
            
            // Return default error response
            return {
                intent: 'help',
                entities: {},
                confidence: 0.5,
                error: error.message
            };
        }
    }

    async processWithLLM(text) {
        try {
            const context = this.getConversationContext();
            const prompt = this.promptTemplates.intent
                .replace('{input}', text)
                .replace('{context}', context);
            
            const response = await this.openai.chat.completions.create({
                model: this.llmConfig.model || 'gemma3:4b',
                messages: [
                    {
                        role: 'system',
                        content: this.promptTemplates.system
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: this.llmConfig.maxTokens || 150,
                temperature: this.llmConfig.temperature || 0.7,
                timeout: this.llmConfig.timeout || 10000
            });
            
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from LLM');
            }
            
            // Parse JSON response
            const result = this.parseNLUResponse(content);
            console.log('LLM NLU result:', result);
            
            return result;
            
        } catch (error) {
            console.error('LLM processing error:', error);
            throw error;
        }
    }

    parseNLUResponse(content) {
        try {
            // Clean up the response to extract JSON
            let jsonStr = content.trim();
            
            // Remove markdown code blocks if present
            jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            
            // Find JSON object in the response
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }
            
            const parsed = JSON.parse(jsonStr);
            
            // Validate required fields
            if (!parsed.intent) {
                throw new Error('Missing intent in response');
            }
            
            return {
                intent: parsed.intent,
                entities: parsed.entities || {},
                confidence: parsed.confidence || 0.8
            };
            
        } catch (error) {
            console.error('Failed to parse NLU response:', content, error);
            throw new Error('Invalid JSON response from LLM');
        }
    }

    processWithPatterns(text) {
        console.log('Processing with fallback patterns:', text);
        
        const normalizedText = text.toLowerCase().trim();
        
        // Check each pattern
        for (const [pattern, result] of this.fallbackPatterns) {
            if (pattern.test(normalizedText)) {
                console.log('Pattern matched:', pattern, result);
                
                // Extract additional entities based on the text
                const enhancedResult = this.enhancePatternResult(normalizedText, result);
                return enhancedResult;
            }
        }
        
        // Default fallback
        return {
            intent: 'help',
            entities: {},
            confidence: 0.3
        };
    }

    enhancePatternResult(text, baseResult) {
        const enhanced = { ...baseResult };
        
        // Extract quantities
        const quantityMatch = text.match(/(\d+)/);
        if (quantityMatch && enhanced.intent === 'add_item') {
            enhanced.entities.quantity = parseInt(quantityMatch[1]);
        }
        
        // Extract potential item names (simple heuristic)
        if (enhanced.intent === 'add_item') {
            const words = text.split(' ');
            const actionWords = ['add', 'want', 'order', 'get', 'have', 'like', 'i', 'me', 'a', 'an', 'the'];
            const potentialItems = words.filter(word => 
                !actionWords.includes(word.toLowerCase()) && 
                !word.match(/^\d+$/) &&
                word.length > 2
            );
            
            if (potentialItems.length > 0) {
                enhanced.entities.item_name = potentialItems.join(' ');
            }
        }
        
        return enhanced;
    }

    getConversationContext() {
        // Get recent conversation history for context
        const recentHistory = this.conversationHistory
            .slice(-this.nluConfig.contextWindow || 5)
            .map(entry => `User: ${entry.input} -> Intent: ${entry.result.intent}`)
            .join('\n');
        
        return recentHistory || 'No previous context';
    }

    addToHistory(input, result) {
        this.conversationHistory.push({
            input,
            result,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        const maxHistory = (this.nluConfig.contextWindow || 5) * 2;
        if (this.conversationHistory.length > maxHistory) {
            this.conversationHistory = this.conversationHistory.slice(-maxHistory);
        }
    }

    async updateConfiguration(newConfig) {
        try {
            this.llmConfig = { ...this.llmConfig, ...newConfig };
            
            // Reinitialize OpenAI client if base URL changed
            if (newConfig.baseURL) {
                this.openai = new OpenAI({
                    baseURL: newConfig.baseURL,
                    apiKey: 'local-key'
                });
                
                // Test new connection
                await this.testConnection();
            }
            
            console.log('NLU Engine configuration updated');
            return true;
            
        } catch (error) {
            console.error('Failed to update NLU configuration:', error);
            throw error;
        }
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            llmAvailable: this.isInitialized,
            model: this.llmConfig.model,
            baseURL: this.llmConfig.baseURL,
            fallbackEnabled: this.nluConfig.fallbackEnabled,
            historySize: this.conversationHistory.length
        };
    }

    clearHistory() {
        this.conversationHistory = [];
        console.log('Conversation history cleared');
    }

    // Advanced entity extraction for specific domains
    async extractEntities(text, entityTypes) {
        if (!this.isInitialized) {
            return this.extractEntitiesWithPatterns(text, entityTypes);
        }
        
        try {
            const prompt = this.promptTemplates.entity
                .replace('{input}', text);
            
            const response = await this.openai.chat.completions.create({
                model: this.llmConfig.model || 'gemma3:4b',
                messages: [
                    {
                        role: 'system',
                        content: `Extract entities of types: ${entityTypes.join(', ')} from restaurant orders.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 100,
                temperature: 0.3
            });
            
            const content = response.choices[0]?.message?.content;
            return this.parseEntityResponse(content);
            
        } catch (error) {
            console.error('Entity extraction error:', error);
            return this.extractEntitiesWithPatterns(text, entityTypes);
        }
    }

    extractEntitiesWithPatterns(text, entityTypes) {
        const entities = {};
        
        // Extract quantities
        if (entityTypes.includes('quantity')) {
            const quantityMatch = text.match(/(\d+)/);
            if (quantityMatch) {
                entities.quantity = parseInt(quantityMatch[1]);
            }
        }
        
        // Extract categories
        if (entityTypes.includes('category')) {
            const categoryPatterns = {
                appetizers: /(appetizer|starter|salad)/i,
                mains: /(main|entree|dinner|lunch)/i,
                beverages: /(drink|beverage|soda|juice)/i,
                desserts: /(dessert|sweet|cake|pie)/i
            };
            
            for (const [category, pattern] of Object.entries(categoryPatterns)) {
                if (pattern.test(text)) {
                    entities.category = category;
                    break;
                }
            }
        }
        
        return entities;
    }

    parseEntityResponse(content) {
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return {};
        } catch (error) {
            console.error('Failed to parse entity response:', error);
            return {};
        }
    }

    async shutdown() {
        console.log('Shutting down NLU Engine...');
        this.isInitialized = false;
        this.conversationHistory = [];
        console.log('NLU Engine shut down successfully');
    }
}

module.exports = NLUEngine;