const BASIC = {
    VARIABLE: Symbol("VARIABLE"),
    OPENING_BRACKET: Symbol("OPENING BRACKET"),
    CLOSING_BRACKET: Symbol("CLOSING BRACKET"),
    LAMBDA: Symbol("LAMBDA"),
    DOT: Symbol("DOT")
}

const LAMBDA_CHAR = "\u03bb"

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
        console.log("Parsing", tokens.slice(start, end), "from", start, "to", end)
        const parsedTokens = []

        let formalParameters = []
        let inLambda = false

        for (let i = start; i < end; i++) {
            const token = tokens[i]

            switch (token.type) {
                case BASIC.OPENING_BRACKET:
                    parsedTokens.push(parse(i + 1, openingToClosing[i]))
                    i = openingToClosing[i]
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

                    i = endOfBlock[i]
                    inLambda = false

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
        console.log("Parsed tokens are", parsedTokens)
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

function leftmostOutermost(rootNode) {
    if (rootNode.type === APPLICATION && rootNode.abstraction.type === ABSTRACTION) {
        return rootNode
    }

    if (rootNode.type === APPLICATION) return leftmostOutermost(rootNode.abstraction) || leftmostOutermost(rootNode.argument);
    if (rootNode.type === ABSTRACTION) return leftmostOutermost(rootNode.body)
    return null;
}

function leftmostInnermost(rootNode) {
    if (rootNode.type === APPLICATION && rootNode.abstraction.type === ABSTRACTION) {
        return leftmostInnermost(rootNode.abstraction) || leftmostInnermost(rootNode.argument) || rootNode
    }

    if (rootNode.type === ABSTRACTION) return leftmostInnermost(rootNode.body);
    if (rootNode.type === APPLICATION) return leftmostInnermost(rootNode.abstraction) || leftmostInnermost(rootNode.argument);
    return null;
}

function handleReduction(rootNode, redex, logEl) {
    // Now, make a log of what the reduction was by cloning the current HTML structure
    // The `true` parameter means the cloning is deep
    console.log("Doing the appending now...")
    const historyEl = document.createElement("DIV")
    historyEl.appendChild(rootNode.HTMLElement.cloneNode(true))
    logEl.appendChild(historyEl)

    // Unhighlight the pre-reduction appearance of the redex
    unhighlightRedex(redex)

    // Perform the actual beta reduction!
    const reductionResult = betaReduce(redex)

    // Clear the old redex object and add the new one (TODO: this is hacky - this trick allows us
    // to have all references to the redex now point to the reduction result -- it would be better
    // to instead update all the references and create a new object)
    for (let key in redex) {
        delete redex[key]
    }

    Object.assign(redex, reductionResult)

    // Finally, re-render the tree and simplified output
    render(rootNode)
    redex.HTMLElement.classList.add('highlighted')
}

function deepClone(rootNode) {
    console.log("Deep cloning", rootNode)
    const newRootNode = {}

    for (let key in rootNode) {
        if (key === HTMLElement) continue;
        if (typeof rootNode[key] === 'object') {
            newRootNode[key] = deepClone(rootNode[key])
        } else {
            newRootNode[key] = rootNode[key]
        }
    }

    return newRootNode
}

function betaReduce(redex) {
    // TODO: consider keeping a reference to the parent instead, to more easily mutate the rootNode

    function substitute(rootNode, name, replacement) {
        if (rootNode.type === BASIC.VARIABLE && rootNode.name === name) {
            return deepClone(replacement)
        }

        if (rootNode.type === APPLICATION) {
            rootNode.abstraction = substitute(rootNode.abstraction, name, replacement)
            rootNode.argument = substitute(rootNode.argument, name, replacement)
        }

        if (rootNode.type === ABSTRACTION) {
            rootNode.body = substitute(rootNode.body, name, replacement)
        }

        return rootNode
    }

    return substitute(redex.abstraction.body, redex.abstraction.formalParameter.name, redex.argument) 
}

function parenNeeded(rootNode) {
    if (rootNode.type === ABSTRACTION) {
        // Lambdas will extend as far right as possible.
        return true;
    } else if (rootNode.type === APPLICATION) {
        return parenNeeded(rootNode.argument)
    } else {
        return false;
    }
}

function makeSpan(classNameSuffix) {
    const span = document.createElement("SPAN")
    span.classList.add("lambda-" + classNameSuffix)
    return span 
}

function htmlify(rootNode) {
    const span = document.createElement("SPAN")

    if (rootNode.type === ABSTRACTION) {
        span.classList.add("abstraction")

        const formalParameter = makeSpan("formal-parameter")
        formalParameter.appendChild(htmlify(rootNode.formalParameter))

        const abstractionBody = makeSpan("body")
        abstractionBody.appendChild(htmlify(rootNode.body))

        const lambdaChar = makeSpan("lambda-char")
        lambdaChar.textContent = LAMBDA_CHAR

        const dotChar = makeSpan("dot-char")
        dotChar.textContent = "."

        span.appendChild(lambdaChar)
        span.appendChild(formalParameter)
        span.appendChild(dotChar)
        span.appendChild(abstractionBody)
    } else if (rootNode.type === APPLICATION) {
        span.classList.add("lambda-application")

        const leftSide = makeSpan("left-side")
        leftSide.appendChild(htmlify(rootNode.abstraction))

        const rightSide = makeSpan("right-side")
        rightSide.appendChild(htmlify(rootNode.argument))

        const leftBracketLambda = makeSpan("left-bracket-lambda")
        const leftBracketArgument = makeSpan("left-bracket-argument")

        const rightBracketLambda = makeSpan("right-bracket-lambda")
        const rightBracketArgument = makeSpan("right-bracket-argument")

        leftBracketLambda.textContent = leftBracketArgument.textContent = "("
        rightBracketLambda.textContent = rightBracketArgument.textContent = ")"



        const isParenNeeded = parenNeeded(rootNode.abstraction)
        
        if (isParenNeeded) { span.appendChild(leftBracketLambda) }
        span.appendChild(leftSide)
        if (isParenNeeded) { span.appendChild(rightBracketLambda) }
        
        if (rootNode.argument.type === APPLICATION) { span.appendChild(leftBracketArgument) }
        span.appendChild(rightSide)
        if (rootNode.argument.type === APPLICATION) { span.appendChild(rightBracketArgument) }
    } else {
        span.classList.add("lambda-var") // variable OR formal parameter
        span.textContent = rootNode.name
    }
    
    rootNode.HTMLElement = span
    return span
}

function tokenize(str) {
    const tokens = []

    for (let i = 0; i < str.length; i++) {
        switch (str[i]) {
            case "\\":
            case LAMBDA_CHAR:
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

    rootNode.canvasX = midX
    rootNode.canvasY = y
    rootNode.canvasRadius = outerRadius
}

function canvasMouse(x, y, rootNode) {
    // TODO: in principle, we should know which half of the tree the relevant
    // node will be so only need to search O(log n) nodes rather than O(n) nodes
    findIntersection(rootNode)


    function findIntersection(node) {
        if (!node) return;

        if (x < node.canvasX + node.canvasRadius &&
            x > node.canvasX - node.canvasRadius &&
            y < node.canvasY + node.canvasRadius &&
            y > node.canvasY - node.canvasRadius
        ) {
            node.HTMLElement.classList.add('highlighted')
            console.log("Found!")
        } else {
            node.HTMLElement.classList.remove('highlighted')
            
            findIntersection(node.body)
            findIntersection(node.abstraction)
            findIntersection(node.argument)
            findIntersection(node.formalParameter)
        }
    }
}
