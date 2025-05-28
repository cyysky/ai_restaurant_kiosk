// DOM Utilities - Safe DOM access patterns with race condition prevention
class DOMUtils {
    constructor() {
        this.elementCache = new Map();
        this.cacheTimeout = 5000; // Cache elements for 5 seconds
        this.retryAttempts = 3;
        this.retryDelay = 50; // 50ms between retries
    }

    /**
     * Safely get an element by ID with caching and retry logic
     * @param {string} elementId - The ID of the element to find
     * @param {boolean} useCache - Whether to use cached result (default: true)
     * @param {number} maxRetries - Maximum retry attempts (default: 3)
     * @returns {HTMLElement|null} The element or null if not found
     */
    safeGetElement(elementId, useCache = true, maxRetries = this.retryAttempts) {
        console.log(`🔍 DOM: Safely getting element '${elementId}'`);
        
        // Check cache first
        if (useCache && this.elementCache.has(elementId)) {
            const cached = this.elementCache.get(elementId);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                console.log(`🔍 DOM: Using cached element '${elementId}'`);
                return cached.element;
            } else {
                // Cache expired, remove it
                this.elementCache.delete(elementId);
            }
        }

        // Try to get element with retries
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const element = document.getElementById(elementId);
                
                if (element) {
                    console.log(`🔍 DOM: Found element '${elementId}' on attempt ${attempt + 1}`);
                    
                    // Cache the successful result
                    if (useCache) {
                        this.elementCache.set(elementId, {
                            element: element,
                            timestamp: Date.now()
                        });
                    }
                    
                    return element;
                } else if (attempt < maxRetries - 1) {
                    console.warn(`🔍 DOM: Element '${elementId}' not found, retrying in ${this.retryDelay}ms...`);
                    // Wait before retry (only if not the last attempt)
                    this.sleep(this.retryDelay);
                }
            } catch (error) {
                console.error(`🔍 DOM: Error getting element '${elementId}' on attempt ${attempt + 1}:`, error);
                if (attempt < maxRetries - 1) {
                    this.sleep(this.retryDelay);
                }
            }
        }

        console.error(`🚨 DOM: Failed to get element '${elementId}' after ${maxRetries} attempts`);
        return null;
    }

    /**
     * Safely update element class with validation
     * @param {string} elementId - The ID of the element
     * @param {string} action - 'add', 'remove', or 'toggle'
     * @param {string} className - The class name to modify
     * @returns {boolean} Success status
     */
    safeUpdateClass(elementId, action, className) {
        console.log(`🔍 DOM: Safely updating class '${className}' (${action}) on '${elementId}'`);
        
        const element = this.safeGetElement(elementId);
        if (!element) {
            console.error(`🚨 DOM: Cannot update class - element '${elementId}' not found`);
            return false;
        }

        if (!element.classList) {
            console.error(`🚨 DOM: Element '${elementId}' has no classList property`);
            return false;
        }

        try {
            switch (action) {
                case 'add':
                    element.classList.add(className);
                    break;
                case 'remove':
                    element.classList.remove(className);
                    break;
                case 'toggle':
                    element.classList.toggle(className);
                    break;
                default:
                    console.error(`🚨 DOM: Invalid class action '${action}'`);
                    return false;
            }
            
            console.log(`🔍 DOM: Successfully updated class '${className}' on '${elementId}'`);
            return true;
        } catch (error) {
            console.error(`🚨 DOM: Error updating class on '${elementId}':`, error);
            return false;
        }
    }

    /**
     * Safely update element text content
     * @param {string} elementId - The ID of the element
     * @param {string} text - The text content to set
     * @returns {boolean} Success status
     */
    safeUpdateText(elementId, text) {
        console.log(`🔍 DOM: Safely updating text on '${elementId}'`);
        
        const element = this.safeGetElement(elementId);
        if (!element) {
            console.error(`🚨 DOM: Cannot update text - element '${elementId}' not found`);
            return false;
        }

        try {
            element.textContent = text;
            console.log(`🔍 DOM: Successfully updated text on '${elementId}'`);
            return true;
        } catch (error) {
            console.error(`🚨 DOM: Error updating text on '${elementId}':`, error);
            return false;
        }
    }

    /**
     * Safely update element style property
     * @param {string} elementId - The ID of the element
     * @param {string} property - The style property to set
     * @param {string} value - The value to set
     * @returns {boolean} Success status
     */
    safeUpdateStyle(elementId, property, value) {
        console.log(`🔍 DOM: Safely updating style '${property}' on '${elementId}'`);
        
        const element = this.safeGetElement(elementId);
        if (!element) {
            console.error(`🚨 DOM: Cannot update style - element '${elementId}' not found`);
            return false;
        }

        if (!element.style) {
            console.error(`🚨 DOM: Element '${elementId}' has no style property`);
            return false;
        }

        try {
            element.style[property] = value;
            console.log(`🔍 DOM: Successfully updated style '${property}' on '${elementId}'`);
            return true;
        } catch (error) {
            console.error(`🚨 DOM: Error updating style on '${elementId}':`, error);
            return false;
        }
    }

    /**
     * Safely query selector within an element
     * @param {string} elementId - The ID of the parent element
     * @param {string} selector - The CSS selector
     * @returns {HTMLElement|null} The found element or null
     */
    safeQuerySelector(elementId, selector) {
        console.log(`🔍 DOM: Safely querying '${selector}' within '${elementId}'`);
        
        const parentElement = this.safeGetElement(elementId);
        if (!parentElement) {
            console.error(`🚨 DOM: Cannot query - parent element '${elementId}' not found`);
            return null;
        }

        try {
            const element = parentElement.querySelector(selector);
            if (element) {
                console.log(`🔍 DOM: Found element with selector '${selector}'`);
            } else {
                console.warn(`🔍 DOM: No element found with selector '${selector}'`);
            }
            return element;
        } catch (error) {
            console.error(`🚨 DOM: Error querying selector '${selector}':`, error);
            return null;
        }
    }

    /**
     * Batch update multiple elements safely
     * @param {Array} operations - Array of operation objects
     * @returns {Object} Results summary
     */
    safeBatchUpdate(operations) {
        console.log(`🔍 DOM: Performing batch update with ${operations.length} operations`);
        
        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        operations.forEach((op, index) => {
            try {
                let success = false;
                
                switch (op.type) {
                    case 'class':
                        success = this.safeUpdateClass(op.elementId, op.action, op.className);
                        break;
                    case 'text':
                        success = this.safeUpdateText(op.elementId, op.text);
                        break;
                    case 'style':
                        success = this.safeUpdateStyle(op.elementId, op.property, op.value);
                        break;
                    default:
                        console.error(`🚨 DOM: Unknown operation type '${op.type}' at index ${index}`);
                        success = false;
                }

                if (success) {
                    results.successful++;
                } else {
                    results.failed++;
                    results.errors.push(`Operation ${index} failed: ${JSON.stringify(op)}`);
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Operation ${index} threw error: ${error.message}`);
                console.error(`🚨 DOM: Batch operation ${index} error:`, error);
            }
        });

        console.log(`🔍 DOM: Batch update complete - ${results.successful} successful, ${results.failed} failed`);
        return results;
    }

    /**
     * Clear the element cache
     */
    clearCache() {
        console.log('🔍 DOM: Clearing element cache');
        this.elementCache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.elementCache.size,
            entries: Array.from(this.elementCache.keys())
        };
    }

    /**
     * Simple sleep function for retries
     * @param {number} ms - Milliseconds to sleep
     */
    sleep(ms) {
        const start = Date.now();
        while (Date.now() - start < ms) {
            // Busy wait for short delays
        }
    }

    /**
     * Validate that critical elements exist
     * @param {Array} elementIds - Array of element IDs to check
     * @returns {Object} Validation results
     */
    validateCriticalElements(elementIds) {
        console.log(`🔍 DOM: Validating ${elementIds.length} critical elements`);
        
        const results = {
            allFound: true,
            found: [],
            missing: [],
            details: {}
        };

        elementIds.forEach(elementId => {
            const element = this.safeGetElement(elementId, false); // Don't cache during validation
            
            if (element) {
                results.found.push(elementId);
                results.details[elementId] = {
                    exists: true,
                    tagName: element.tagName,
                    classList: Array.from(element.classList || []),
                    parentNode: element.parentNode?.tagName || null
                };
            } else {
                results.missing.push(elementId);
                results.allFound = false;
                results.details[elementId] = {
                    exists: false
                };
            }
        });

        if (!results.allFound) {
            console.error(`🚨 DOM: ${results.missing.length} critical elements missing:`, results.missing);
        } else {
            console.log(`✅ DOM: All ${elementIds.length} critical elements found`);
        }

        return results;
    }
}

// Create global instance
const domUtils = new DOMUtils();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DOMUtils;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.DOMUtils = DOMUtils;
    window.domUtils = domUtils;
}