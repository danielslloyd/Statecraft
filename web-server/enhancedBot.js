/**
 * Enhanced Bot Player with Trust System and Probabilistic Decision Making
 *
 * Features:
 * - Trust values for each other player
 * - Value system for evaluating positions and threats
 * - Probabilistic move selection
 * - Contextual message generation
 */

const { NATIONS, PROVINCES, ADJACENCIES, UNIT_TYPES, ORDER_TYPES } = require('../gameData.js');

class EnhancedBotPlayer {
    constructor(nation, gameState) {
        this.nation = nation;
        this.gameState = gameState;

        // Trust values for other nations (-1 to 1, where 1 is complete trust, -1 is enemy)
        this.trustValues = new Map();

        // Historical tracking
        this.promisesMade = new Map(); // nation -> promises made to them
        this.promisesBroken = new Map(); // nation -> count of broken promises
        this.alliances = new Set(); // nations we're allied with
        this.enemies = new Set(); // nations we're at war with

        // Personality traits (randomized for variety)
        this.personality = {
            aggression: 0.3 + Math.random() * 0.4, // 0.3 - 0.7
            trustingness: 0.2 + Math.random() * 0.6, // 0.2 - 0.8
            chattiness: 0.2 + Math.random() * 0.6, // 0.2 - 0.8
            deception: Math.random() * 0.5, // 0.0 - 0.5
            loyalty: 0.3 + Math.random() * 0.5 // 0.3 - 0.8
        };

        this.initializeTrust();
    }

    initializeTrust() {
        // Initialize trust values for all other nations
        for (const nation of Object.keys(NATIONS)) {
            if (nation !== this.nation) {
                // Start with slight positive trust, adjusted by personality
                this.trustValues.set(nation, 0.1 + (this.personality.trustingness * 0.2));
                this.promisesMade.set(nation, []);
                this.promisesBroken.set(nation, 0);
            }
        }

        // Set geographic neighbors as slightly more trusted (shared interests)
        const myUnits = this.gameState.getUnitsForNation(this.nation);
        myUnits.forEach(unit => {
            const adjacentProvinces = ADJACENCIES[unit.province] || [];
            adjacentProvinces.forEach(adjProv => {
                const adjUnit = this.gameState.getUnit(adjProv);
                if (adjUnit && adjUnit.nation !== this.nation) {
                    const currentTrust = this.trustValues.get(adjUnit.nation);
                    this.trustValues.set(adjUnit.nation, currentTrust + 0.1);
                }
            });
        });
    }

    /**
     * Update trust values based on game events and player actions
     */
    updateTrustValues(gameData) {
        const mySupplyCenters = this.gameState.getSupplyCount(this.nation);

        for (const nation of Object.keys(NATIONS)) {
            if (nation === this.nation) continue;

            let trustChange = 0;

            // Evaluate relative strength
            const theirSupplyCenters = this.gameState.getSupplyCount(nation);
            const strengthRatio = theirSupplyCenters / Math.max(mySupplyCenters, 1);

            // If they're much stronger, be more wary
            if (strengthRatio > 1.5) {
                trustChange -= 0.05;
            }

            // If they're weaker, might trust more (or see as target if aggressive)
            if (strengthRatio < 0.7) {
                trustChange += this.personality.aggression > 0.5 ? -0.02 : 0.03;
            }

            // Check proximity - neighboring units make us nervous
            const proximityThreat = this.evaluateProximityThreat(nation);
            trustChange -= proximityThreat * 0.1;

            // Check if they've been messaging us positively
            const recentMessages = gameData.messages
                .filter(msg => msg.from === nation &&
                       (msg.to === 'all' || msg.to.includes(this.nation)))
                .slice(-5); // Last 5 messages

            const positiveMessages = recentMessages.filter(msg =>
                this.isMessagePositive(msg.content)
            ).length;

            if (positiveMessages > 2) {
                trustChange += 0.05;
            }

            // Apply trust change with decay towards neutral
            let currentTrust = this.trustValues.get(nation);
            currentTrust += trustChange;

            // Decay towards 0 over time (people forget)
            currentTrust *= 0.98;

            // Clamp between -1 and 1
            currentTrust = Math.max(-1, Math.min(1, currentTrust));

            this.trustValues.set(nation, currentTrust);

            // Update alliances and enemies
            if (currentTrust > 0.6) {
                this.alliances.add(nation);
                this.enemies.delete(nation);
            } else if (currentTrust < -0.4) {
                this.enemies.add(nation);
                this.alliances.delete(nation);
            }
        }
    }

    /**
     * Evaluate how threatening a nation is based on proximity
     */
    evaluateProximityThreat(nation) {
        const myUnits = this.gameState.getUnitsForNation(this.nation);
        const theirUnits = this.gameState.getUnitsForNation(nation);

        let threatLevel = 0;

        myUnits.forEach(myUnit => {
            const adjacentProvinces = ADJACENCIES[myUnit.province] || [];

            theirUnits.forEach(theirUnit => {
                // Direct adjacency
                if (adjacentProvinces.includes(theirUnit.province)) {
                    threatLevel += 0.5;
                }

                // Two provinces away
                const theirAdjacent = ADJACENCIES[theirUnit.province] || [];
                const commonNeighbors = adjacentProvinces.filter(p =>
                    theirAdjacent.includes(p)
                );
                if (commonNeighbors.length > 0) {
                    threatLevel += 0.2;
                }
            });
        });

        return Math.min(1, threatLevel);
    }

    /**
     * Determine if a message is positive/friendly
     */
    isMessagePositive(content) {
        const positiveWords = [
            'alliance', 'ally', 'friend', 'support', 'help', 'cooperate',
            'together', 'peace', 'agree', 'trust', 'good', 'great'
        ];

        const negativeWords = [
            'attack', 'war', 'enemy', 'threat', 'betray', 'destroy',
            'fight', 'oppose', 'against'
        ];

        const lowerContent = content.toLowerCase();

        const positiveCount = positiveWords.filter(w => lowerContent.includes(w)).length;
        const negativeCount = negativeWords.filter(w => lowerContent.includes(w)).length;

        return positiveCount > negativeCount;
    }

    /**
     * Generate orders using probabilistic decision making
     */
    generateOrders() {
        const orders = [];
        const myUnits = this.gameState.getUnitsForNation(this.nation);

        myUnits.forEach(unit => {
            const order = this.generateOrderForUnit(unit);
            if (order) {
                orders.push(order);
            }
        });

        return orders;
    }

    /**
     * Generate order for a specific unit using probability-weighted options
     */
    generateOrderForUnit(unit) {
        const options = this.evaluateMoveOptions(unit);

        if (options.length === 0) {
            // Default to hold
            return {
                unitId: unit.id,
                type: ORDER_TYPES.HOLD,
                from: unit.province
            };
        }

        // Use probability distribution to select move
        const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
        let random = Math.random() * totalWeight;

        for (const option of options) {
            random -= option.weight;
            if (random <= 0) {
                return option.order;
            }
        }

        // Fallback to highest weighted option
        return options[0].order;
    }

    /**
     * Evaluate possible moves for a unit and assign weights
     */
    evaluateMoveOptions(unit) {
        const options = [];
        const adjacentProvinces = ADJACENCIES[unit.province] || [];

        // Hold option (always available)
        options.push({
            order: {
                unitId: unit.id,
                type: ORDER_TYPES.HOLD,
                from: unit.province
            },
            weight: 1.0 // Base weight
        });

        // Move options
        adjacentProvinces.forEach(destProvince => {
            if (!this.gameState.canUnitReach(unit, destProvince)) {
                return;
            }

            const weight = this.evaluateMoveWeight(unit, destProvince);

            if (weight > 0) {
                options.push({
                    order: {
                        unitId: unit.id,
                        type: ORDER_TYPES.MOVE,
                        from: unit.province,
                        to: destProvince
                    },
                    weight
                });
            }
        });

        // Sort by weight (highest first)
        options.sort((a, b) => b.weight - a.weight);

        return options;
    }

    /**
     * Evaluate weight for moving to a destination
     */
    evaluateMoveWeight(unit, destProvince) {
        let weight = 0.5; // Base weight

        const destProvinceData = PROVINCES[destProvince];
        const currentProvinceData = PROVINCES[unit.province];

        // Supply center bonus
        if (destProvinceData.supply) {
            const owner = this.gameState.supplyCenters[destProvince];

            if (!owner) {
                // Neutral supply center - very attractive
                weight += 3.0;
            } else if (owner !== this.nation) {
                // Enemy supply center
                const trust = this.trustValues.get(owner) || 0;

                if (trust < 0 || this.enemies.has(owner)) {
                    // Enemy - take it!
                    weight += 2.0 * this.personality.aggression;
                } else if (trust < 0.3) {
                    // Neutral/slight positive - maybe take it
                    weight += 1.0 * this.personality.aggression;
                } else {
                    // Ally - don't attack
                    weight -= 2.0;
                }
            }
        }

        // Check if there's an enemy unit there
        const occupyingUnit = this.gameState.getUnit(destProvince);
        if (occupyingUnit && occupyingUnit.nation !== this.nation) {
            const trust = this.trustValues.get(occupyingUnit.nation) || 0;

            if (this.enemies.has(occupyingUnit.nation) || trust < -0.3) {
                // Attack enemy
                weight += 1.5 * this.personality.aggression;
            } else if (trust < 0.3) {
                // Might bounce/contest
                weight += 0.3;
            } else {
                // Allied unit - avoid conflict
                weight -= 1.5;
            }
        }

        // Expansion preference
        if (!currentProvinceData.supply && destProvinceData.supply) {
            weight += 1.0;
        }

        // Add some randomness for unpredictability
        weight += (Math.random() - 0.5) * 0.5;

        return Math.max(0, weight);
    }

    /**
     * Generate a message to send to other players
     */
    generateMessage(gameData) {
        // Chattiness check
        if (Math.random() > this.personality.chattiness) {
            return null;
        }

        const messageTypes = [
            'alliance_proposal',
            'threat',
            'friendly_chat',
            'negotiation',
            'boast',
            'plead'
        ];

        // Weight message types by personality and situation
        const weights = this.getMessageTypeWeights();
        const type = this.weightedRandom(messageTypes, weights);

        switch (type) {
            case 'alliance_proposal':
                return this.generateAllianceProposal();
            case 'threat':
                return this.generateThreat();
            case 'friendly_chat':
                return this.generateFriendlyChat();
            case 'negotiation':
                return this.generateNegotiation();
            case 'boast':
                return this.generateBoast();
            case 'plead':
                return this.generatePlea();
            default:
                return null;
        }
    }

    getMessageTypeWeights() {
        const mySupplyCenters = this.gameState.getSupplyCount(this.nation);
        const maxSupplyCenters = Math.max(...Object.keys(NATIONS).map(n =>
            this.gameState.getSupplyCount(n)
        ));

        const isWinning = mySupplyCenters === maxSupplyCenters;
        const isLosing = mySupplyCenters < 4;

        return {
            'alliance_proposal': this.personality.trustingness * (isLosing ? 2 : 1),
            'threat': this.personality.aggression * (isWinning ? 1.5 : 0.5),
            'friendly_chat': this.personality.chattiness,
            'negotiation': (1 - this.personality.aggression) * 1.5,
            'boast': isWinning ? this.personality.aggression * 2 : 0.1,
            'plead': isLosing ? 2.0 : 0.1
        };
    }

    weightedRandom(items, weights) {
        const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < items.length; i++) {
            random -= weights[items[i]] || 0;
            if (random <= 0) {
                return items[i];
            }
        }

        return items[0];
    }

    generateAllianceProposal() {
        // Find best candidate for alliance
        const candidates = Array.from(this.trustValues.entries())
            .filter(([nation, trust]) => !this.alliances.has(nation) && trust > 0.2)
            .sort((a, b) => b[1] - a[1]);

        if (candidates.length === 0) return null;

        const [targetNation] = candidates[0];

        const messages = [
            `${NATIONS[targetNation].shortName}, I propose we form an alliance. Together we can dominate this game!`,
            `Hey ${NATIONS[targetNation].shortName}, let's work together. We both have a lot to gain from cooperation.`,
            `${NATIONS[targetNation].shortName}, I think we should join forces against our common enemies.`,
            `Looking to ally with ${NATIONS[targetNation].shortName}. What do you say?`
        ];

        return {
            to: [targetNation],
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    generateThreat() {
        // Threaten an enemy
        const enemies = Array.from(this.enemies);
        if (enemies.length === 0) {
            // Threaten someone we don't trust
            const lowTrust = Array.from(this.trustValues.entries())
                .filter(([_, trust]) => trust < 0)
                .sort((a, b) => a[1] - b[1]);

            if (lowTrust.length === 0) return null;
            enemies.push(lowTrust[0][0]);
        }

        const targetNation = enemies[Math.floor(Math.random() * enemies.length)];

        const messages = [
            `${NATIONS[targetNation].shortName}, you better watch your borders. I'm coming for you.`,
            `${NATIONS[targetNation].shortName}, your expansion ends now.`,
            `Careful ${NATIONS[targetNation].shortName}, you're making enemies.`,
            `${NATIONS[targetNation].shortName}, I suggest you reconsider your position.`
        ];

        return {
            to: [targetNation],
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    generateFriendlyChat() {
        const allies = Array.from(this.alliances);
        const targetNation = allies.length > 0
            ? allies[Math.floor(Math.random() * allies.length)]
            : Array.from(this.trustValues.keys())[Math.floor(Math.random() * this.trustValues.size)];

        const messages = [
            `Good game so far, ${NATIONS[targetNation].shortName}!`,
            `Hey ${NATIONS[targetNation].shortName}, how's it going?`,
            `${NATIONS[targetNation].shortName}, this is getting interesting!`,
            `Nice moves, ${NATIONS[targetNation].shortName}.`
        ];

        return {
            to: [targetNation],
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    generateNegotiation() {
        // Negotiate with someone
        const candidates = Array.from(this.trustValues.entries())
            .filter(([nation, trust]) => trust > -0.3 && !this.alliances.has(nation))
            .sort((a, b) => b[1] - a[1]);

        if (candidates.length === 0) return null;

        const [targetNation] = candidates[0];

        const messages = [
            `${NATIONS[targetNation].shortName}, let's discuss our shared border. I propose a DMZ.`,
            `${NATIONS[targetNation].shortName}, I won't attack you if you don't attack me. Deal?`,
            `Hey ${NATIONS[targetNation].shortName}, what if we split the neutral territories between us?`,
            `${NATIONS[targetNation].shortName}, I have a proposal that benefits us both...`
        ];

        return {
            to: [targetNation],
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    generateBoast() {
        const messages = [
            `I'm in a strong position this turn. Anyone want to negotiate?`,
            `My empire is growing nicely. Who wants to be on the winning side?`,
            `Looking unstoppable right now!`,
            `Just took another supply center. Who's next?`
        ];

        return {
            to: 'all',
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    generatePlea() {
        const messages = [
            `I'm struggling here. Anyone willing to help me out?`,
            `Can we all agree to gang up on the leader?`,
            `I need allies or I'm done for!`,
            `Someone please help me survive this turn.`
        ];

        return {
            to: 'all',
            content: messages[Math.floor(Math.random() * messages.length)]
        };
    }

    /**
     * Generate a response to a message from another player
     */
    generateResponseTo(fromNation, content, gameData) {
        const trust = this.trustValues.get(fromNation) || 0;
        const lowerContent = content.toLowerCase();

        // Detect message intent
        if (lowerContent.includes('alliance') || lowerContent.includes('ally')) {
            if (trust > 0.3 || (trust > 0 && Math.random() < this.personality.trustingness)) {
                this.alliances.add(fromNation);
                return this.acceptAlliance(fromNation);
            } else {
                return this.declineAlliance(fromNation);
            }
        }

        if (lowerContent.includes('attack') || lowerContent.includes('war')) {
            this.enemies.add(fromNation);
            this.trustValues.set(fromNation, Math.min(trust - 0.3, -0.5));
            return this.respondToThreat(fromNation);
        }

        if (lowerContent.includes('help') || lowerContent.includes('support')) {
            if (trust > 0.4) {
                return this.offerHelp(fromNation);
            } else {
                return this.refuseHelp(fromNation);
            }
        }

        // Generic friendly response
        if (trust > 0.2) {
            return this.friendlyResponse(fromNation);
        }

        // 50% chance to respond to neutrals/enemies
        if (Math.random() < 0.5) {
            return this.neutralResponse(fromNation);
        }

        return null;
    }

    acceptAlliance(nation) {
        const messages = [
            `Yes! Let's work together.`,
            `Alliance accepted. I'll support you.`,
            `Agreed. We'll be unstoppable together!`,
            `Deal. Let's coordinate our moves.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    declineAlliance(nation) {
        const messages = [
            `I'll have to pass on that.`,
            `Not right now, maybe later.`,
            `I'm not sure I trust that arrangement.`,
            `Let me think about it...`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    respondToThreat(nation) {
        const messages = [
            `Bring it on!`,
            `We'll see about that.`,
            `You'll regret threatening me.`,
            `I'm not afraid of you.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    offerHelp(nation) {
        const messages = [
            `I'll help you out.`,
            `Sure, I can support you this turn.`,
            `Let's work together.`,
            `I've got your back.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    refuseHelp(nation) {
        const messages = [
            `Sorry, I can't help right now.`,
            `I need to focus on my own position.`,
            `Maybe next turn.`,
            `I don't think I can spare the units.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    friendlyResponse(nation) {
        const messages = [
            `Sounds good!`,
            `I agree.`,
            `Let's do it.`,
            `Good idea.`,
            `I'm on board.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    neutralResponse(nation) {
        const messages = [
            `Noted.`,
            `Interesting.`,
            `I'll consider it.`,
            `Maybe.`,
            `We'll see.`
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }
}

module.exports = { EnhancedBotPlayer };
