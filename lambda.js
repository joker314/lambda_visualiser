const BASIC = {
    VARIABLE: Symbol("VARIABLE"),
    OPENING_BRACKET: Symbol("OPENING BRACKET"),
    CLOSING_BRACKET: Symbol("CLOSING BRACKET"),
    LAMBDA: Symbol("LAMBDA"),
    DOT: Symbol("DOT")
}

const ABSTRACTION = Symbol("ABSTRACTION")
const APPLICATION = Symbol("APPLICATION")

function getBracketPairs(tokens) {
    const openingToClosing = {};
    const closingToOpening = {};

    const openingBrackets = [];

    tokens.forEach((token, i) => {
        switch (token.type) {
            case BASIC.OPENING_BRACKET:
                openingBrackets.push(i)
                break
            
            case BASIC.CLOSING_BRACKET:
                if (openingBrackets.length === 0) {
                    throw new Error(`Unmatched closing bracket at position ${i}`);
                }

                const openingBracket = openingBrackets.pop()
                
                openingToClosing[openingBracket] = i
                closingToOpening[i] = openingBracket
                break
        }
    });

    if (openingBrackets.length) {
        throw new Error(`Opening bracket at ${openingBrackets.pop()} was never closed`)
    }

    // Implement "jump to end of this bracket's block"
    // Same as above but traverse in reverse
    // TODO: can be combined into one if previous code also iterated in reverse
    const endOfBlock = []
    const closingBrackets = [tokens.length]

    for (let i = tokens.length - 1; i >= 0; i--) {
        endOfBlock.push(closingBrackets.at(-1))
        const token = tokens[i]

        switch (token.type) {
            case BASIC.CLOSING_BRACKET:
                closingBrackets.push(i)
                break

            case BASIC.OPENING_BRACKET:
                closingBrackets.pop()
                break
        }
    }

    endOfBlock.reverse()

    return { openingToClosing, closingToOpening, endOfBlock }
}

function parseAll(tokens) {
    const { openingToClosing, closingToOpening, endOfBlock } = getBracketPairs(tokens)
    return parse(0, tokens.length)

    function parse(start, end) {
        console.log("Parsing", tokens.slice(start, end))
        const parsedTokens = []

        let formalParameters = []
        let inLambda = false

        for (let i = start; i < end; i++) {
            const token = tokens[i]

            switch (token.type) {
                case BASIC.OPENING_BRACKET:
                    parsedTokens.push(parse(i + 1, openingToClosing[i]))
                    i = openingToClosing[i] + 1
                    break

                case BASIC.LAMBDA:
                    if (inLambda) {
                        throw new Error(`New lambda started at ${i} without dot-terminating previous lambda`)
                    }

                    inLambda = true
                    break;
                
                case BASIC.DOT:
                    if (!inLambda) {
                        throw new Error(`Dot at ${i} used without a preceding lambda`)
                    } else if (formalParameters.length === 0) {
                        throw new Error(`Dot used immediately after lambda at ${i}, with no formal parameters in between`)
                    } else {
                        // Create a new abstraction token for the last formal parameter
                        const lastFormalParameter = formalParameters.at(-1)

                        const abstractionToken = {
                            type: ABSTRACTION,
                            formalParameter: { type: BASIC.VARIABLE, name: lastFormalParameter },
                            body: parse(i + 1, endOfBlock[i])
                        }

                        // Somtimes, multiple formal parameters are specified, such as:
                        // \ a b c d . d
                        // This is in fact shorthand for
                        // \ a . \ b . \ c . \ d . d
                        // Thus, we must now create these intermediate abstractions (if they exist)
                        let currentAbstraction = abstractionToken

                        for (let i = formalParameters.length - 2; i >= 0; i--) {
                            currentAbstraction = {
                                type: ABSTRACTION,
                                formalParameter: { type: BASIC.VARIABLE, name: formalParameters[i] },
                                body: currentAbstraction
                            }
                        }

                        parsedTokens.push(currentAbstraction)
                    }

                    break;

                case BASIC.VARIABLE:
                    if (inLambda) {
                        formalParameters.push(token.name)
                    } else {
                        // Variables can be passed through as-is as tokens in their own right
                        parsedTokens.push(token)
                    }

                    break;

                default:
                   throw new Error(`Unexpected token of type ${token.type.toString()} at ${i}`)
            }
        }

        if (parsedTokens.length === 0) {
            throw new Error(`Subexpression between ${start} and ${end} had nothing to parse`)
        }

        // Now we can move left-to-right collapsing everything into an application
        let currentApplication = parsedTokens[0]

        parsedTokens.forEach((token, i) => {
            if (i === 0) {
                // Already handled as initial value of `currentApplication`
                return;
            }

            currentApplication = {
                type: APPLICATION,
                abstraction: currentApplication,
                argument: token
            }
        })

        return currentApplication
    }
}

function tokenize(str) {
    const tokens = []

    for (let i = 0; i < str.length; i++) {
        switch (str[i]) {
            case "\\":
            case "λ":
                tokens.push({ type: BASIC.LAMBDA })
                break

            case ".":
                tokens.push({ type: BASIC.DOT })
                break

            case "(":
                tokens.push({ type: BASIC.OPENING_BRACKET })
                break

            case ")":
                tokens.push({ type: BASIC.CLOSING_BRACKET })
                break

            default:
                // Ignore whitespace, but treat everything else as a variable
                if (/\S/.test(str[i])) {
                    tokens.push({ type: BASIC.VARIABLE, name: str[i] })
                }

        }
    }

    return tokens
}

function handleInput(str) {
    return parseAll(tokenize(str))
}

/**
 * ctx - a 2d canvas context for an HTML <canvas> element
 * rootNode - an object returned by `parseAll`
 * x, y - the top left corner of the bounding box which will contain the drawing
 * width - the horizontal width of the bounding box which will contain the drawing
 */
function displayParseTree(ctx, rootNode, x, y, width) {
    const midX = (x + width / 2);
    const outerRadius = 20
    const verticalGap = 5
    
    switch (rootNode.type) {
        
        case APPLICATION:
            const innerRadius = 8

            // Draw a circle together with two minicircles inside, representing application
            ctx.beginPath()
            ctx.fillStyle = "lightblue"
            ctx.arc(midX, y, outerRadius, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.fillStyle = "white"
            ctx.arc(midX - outerRadius / 4, y, innerRadius, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.strokeStyle = "white"
            ctx.arc(midX + outerRadius / 4, y, innerRadius, 0, 2 * Math.PI)
            ctx.stroke()

            // Draw the two children
            displayParseTree(ctx, rootNode.abstraction, x, y + 2 * outerRadius + verticalGap, width / 2)
            displayParseTree(ctx, rootNode.argument, midX, y + 2 * outerRadius + verticalGap, width / 2) 
            break

        case ABSTRACTION:
            ctx.beginPath()
            ctx.fillStyle = "orange"
            ctx.arc(midX, y, outerRadius, 0, 2 * Math.PI)
            ctx.fill()

            displayParseTree(ctx, rootNode.formalParameter, x, y + outerRadius + verticalGap, width / 2)
            displayParseTree(ctx, rootNode.body, midX, y + outerRadius + verticalGap, width / 2)
            break

        default:
            ctx.beginPath()
            ctx.fillStyle = "black"
            ctx.arc(midX, y, outerRadius, 0, 2 * Math.PI)
            ctx.fill()

            ctx.beginPath()
            ctx.fillStyle = "white"
            ctx.fillText(rootNode.name, midX, y)
            ctx.fill()
    }
}
