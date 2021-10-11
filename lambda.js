const BASIC = {
    VARIABLE: Symbol("VARIABLE"),
    OPENING_BRACKET: Symbol("OPENING BRACKET"),
    CLOSING_BRACKET: Symbol("CLOSING BRACKET"),
    LAMBDA: Symbol("LAMBDA"),
    DOT: Symbol("DOT"),
    NUMBER: Symbol("NUMBER")
}

const LAMBDA_CHAR = "\u03bb"
const ALPHA_CHAR = "\u03b1"
const RIGHT_ARROW_CHAR = "\u2192"

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

function churchEncode(n) {
    function churchEncodedBody(n) {
        if (n === 0) {
            return { type: BASIC.VARIABLE, name: "x" }
        } else {
            return {
                type: APPLICATION,
                abstraction: { type: BASIC.VARIABLE, name: "f" },
                argument: churchEncodedBody(n - 1)
            }
        }
    }

    return {
        type: ABSTRACTION,
        formalParameter: { type: BASIC.VARIABLE, name: "f" },
        body: {
            type: ABSTRACTION,
            formalParameter: { type: BASIC.VARIABLE, name: "x" },
            body: churchEncodedBody(n)
        }
    }
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
                case BASIC.NUMBER:
                    if (inLambda) {
                        throw new Error(`Church numeral ${token.value} used as formal parameter`)
                    }

                    parsedTokens.push(churchEncode(token.value))
                    break

                case BASIC.OPENING_BRACKET:
                    if (inLambda) {
                        throw new Error(`Opening bracket at ${i} is not a valid formal parameter`)
                    }

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

function setUnion(setA, setB) {
    return new Set([...setA, ...setB])
}

function setButWithout(set, withoutMe) {
    const smallerSet = new Set(set)
    smallerSet.delete(withoutMe)
    return smallerSet
}

function findFreeVariables(rootNode) {
    if (rootNode.type === ABSTRACTION) {
        return rootNode.freeVariables = setButWithout(findFreeVariables(rootNode.body), rootNode.formalParameter.name)
    } else if (rootNode.type === APPLICATION) {
        return rootNode.freeVariables = setUnion(
            findFreeVariables(rootNode.abstraction),
            findFreeVariables(rootNode.argument)
        )
    } else {
        return rootNode.freeVariables = new Set([rootNode.name])
    }
}

/* A node contains a bound variable iff it contains as a subtree a lambda
 * abstraction which binds that variable. This lets you figure out if you need
 * to alpha convert before a beta reduction.
 *
 * XXX: You can't just check whether or not a variable is in the binders object in order
 *      to deduce whether or not the variable is free in a subexpression. The only time you
 *      can do this is when the subexpression is the entire expression. This is since the binder might
 *      be outside the subexpression. Instead, also make sure that the variable is in the set
 *      of free variables at the root of the subexpression.
 *
 * TODO: Determining the binders of a particular node can be done on a per-need basis (think DP), there
 *       isn't a strict need to precompute at the start. But this will be efficient enough for now.
 *
 * Also, there is much more subtely to alpha conversion than might first appear. Consider \b.b\b.bb. If we
 * distinguish between formal parameters and variables, and then incorrectly apply alpha conversion to variables
 * with the same name but bound by different binders, we may end up with \a.a\b.aa. We could treat formal parameters
 * as variables, in which case alpha-converting b->a would correctly yield \a.a\a.aa.
 *
 * One thing I didn't immediately realise is that beta reduction concerns replacing FREE occurances in the body of an
 * abstraction only. It does not concern replacing bound variables. This means that each variable can only occur once and
 * all is once again well.
 *
 * But notice that it's still possible for the same variable to be bound in multiple abstractions, like this:
 * (\a. \x.a \x.a)(x).
 *
 * And also, it's still possible for this abstraction to exist:
 * (\a. \x. (a \x. a))(x)
 *
 * The best way forward appears to be to find all free instances of the variable being replaced, and then
 * collecting the binders of each of those variables into a Set structure. Then, each of the members of that
 * set can be iterated in turn.
 *
 * Perhaps the most annoying thing is that doing two alpha conversions at the same time is
 */
function findBoundVariables(rootNode, binders = {}) {
    const newBinders = {...binders}

    if (rootNode.type === ABSTRACTION) {
        newBinders[rootNode.formalParameter.name] = rootNode
    }

    rootNode.binders = newBinders

    // Propogate down the tree
    if (rootNode.type === ABSTRACTION) {
        findBoundVariables(rootNode.body, newBinders)
    }

    if (rootNode.type === APPLICATION) {
        findBoundVariables(rootNode.abstraction, newBinders)
        findBoundVariables(rootNode.argument, newBinders)
    }
}

/**
 * For a given variable name `x`, finds all bound vars that are in scope for free `x`, i.e.
 * the binders that would make an alpha conversion to the bound variable illegal.
 *
 * XXX: This was quite hard to write. I was hoping the definition could come from
 *      freeVariables and binders alone
 *
 * TODO: This was poorly thought out. It is confusing to first gather the binders that need to be renamed,
 *       and only then to determine what valid renamings are possible. Both should be done in one step to keep
 *       things clean.
 *
 * XXX: To summarise, the alpha conversion algorithm as it currently is, is:
 *        - find all binders which shadow a free variable in the argument to the redex
 *        - for each one, find all the variables tied to that binder
 *        - for each variable, find the binders in scope
 */
function findVariablesInScope(binder) {
    const freeVar = binder.formalParameter.name
    return [...getScopes(binder.body)]

    function getScopes(node) {
        if (node.type === ABSTRACTION) {
            // This abstraction rebinds the variable, so we don't need to worry
            // about it.
            if (node.formalParameter.name === freeVar) {
                return new Set()
            }

            return getScopes(node.body)
        } else if (node.type === APPLICATION) {
            return setUnion(
                getScopes(node.abstraction),
                getScopes(node.argument)
            )
        } else if (node.name === freeVar) {
            // Determine which variables are in scope
            const varsInScope = new Set();

            for (let varName in node.binders) {
                if (node.binders[varName] !== binder.binders[varName]) {
                    varsInScope.add(varName)
                }
            }

            return varsInScope
        } else {
            return new Set()
        }
    }
}

// Find which binders need to be alpha-converted
function getBindersToRename(redex) {
    const freeVariables = redex.argument.freeVariables
    const boundName = redex.abstraction.formalParameter.name

    const bindersToRenameList = (
        Array.from(freeVariables)
            .flatMap(
                freeName => Array.from(getBindersWithName(
                    redex.abstraction.body,
                    freeName
                )
            ))
    )

    const bindersToRename = new Set(bindersToRenameList)

    console.log("freeVariables", freeVariables, [...freeVariables])
    console.log("mapped version", [...freeVariables].map(
        freeName => getBindersWithName(redex.abstraction.body, freeName)
    ))
    console.log("bindersToRenameList", bindersToRenameList)

    return [...bindersToRename]

    function getBindersWithName(rootNode, freeName) {
        // Check to make sure boundName is in freeVariables before traversing
        // This means we never check inside a binder that rebinds the variable
        // (We could have done that check explicitly with
        // rootNode.type === ABSTRACTION && rootNode.formalParameter === boundName
        // but the advantage of instead doing THIS is that we prune the search tree
        // much earlier
        if (!rootNode.freeVariables.has(boundName)) {
            return new Set()
        }

        if (rootNode.type === APPLICATION) {
            return new Set([
                ...getBindersWithName(rootNode.abstraction, freeName),
                ...getBindersWithName(rootNode.argument, freeName)
            ])
        } else if (rootNode.type === ABSTRACTION) {
            if (rootNode.formalParameter.name === freeName) {
                return new Set([
                    rootNode,
                    ...getBindersWithName(rootNode.body, freeName) // since \x.\x.x is valid
                ])
            } else {
                return getBindersWithName(rootNode.body, freeName)
            }
        } else {
            return new Set()
        }
    }
}

function isBetaRedex(rootNode) {
    return rootNode.type === APPLICATION && rootNode.abstraction.type === ABSTRACTION
}

function leftmostOutermost(rootNode) {
    if (isBetaRedex(rootNode)) {
        return rootNode
    }

    if (rootNode.type === APPLICATION) return leftmostOutermost(rootNode.abstraction) || leftmostOutermost(rootNode.argument);
    if (rootNode.type === ABSTRACTION) return leftmostOutermost(rootNode.body)
    return null;
}

function leftmostInnermost(rootNode) {
    if (isBetaRedex(rootNode)) {
        return leftmostInnermost(rootNode.abstraction) || leftmostInnermost(rootNode.argument) || rootNode
    }

    if (rootNode.type === ABSTRACTION) return leftmostInnermost(rootNode.body);
    if (rootNode.type === APPLICATION) return leftmostInnermost(rootNode.abstraction) || leftmostInnermost(rootNode.argument);
    return null;
}

function handleReduction(rootNode, redex, logEl, alphaElements) {
    console.log("Fed with", rootNode, redex, logEl, alphaElements)

    // Determine if alpha conversion is needed first
    const bindersToRename = getBindersToRename(redex)
    console.log("Binders to rename:", bindersToRename)
    
    displayNextAlpha(0)
    
    // XXX: converts a loop into tail recursion through event listeners
    function displayNextAlpha(i) {
        if (i === bindersToRename.length) {
            alphaElements.box.style.display = 'none'
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
            // redex.HTMLElement.classList.add('highlighted')
               
        } else {
            // XXX: originally, I missed that you also have to avoid capturing the free variables
            // (not just make sure your own variables don't get captured)
            // AND I additionally forgot that you need to not capture any of the other variables either...
            const binder = bindersToRename[i]
            const bannedVariables = [...new Set(
                [
                    ...findVariablesInScope(binder),
                    ...binder.body.freeVariables,
                    ...redex.argument.freeVariables
                ]
            )]

            alphaElements.box.style.display = 'inline-block';
            alphaElements.oldName.textContent = bindersToRename[i].formalParameter.name
            alphaElements.bannedVariables.textContent = bannedVariables.join(', ')

            redex.abstraction.HTMLElement.style.backgroundColor = 'lightgreen'
            binder.formalParameter.HTMLElement.style.color = 'red'

            alphaElements.submitAlpha.onclick = function () {
                const newName = alphaElements.newName.value

                if (newName === "" || bannedVariables.includes(newName)) {
                    // Do nothing - the input was invalid
                    return;
                }

                binder.formalParameter.HTMLElement.style.color = 'black'
                substitute(binder.body, binder.formalParameter.name, { type: BASIC.VARIABLE, name: newName })
                binder.formalParameter.name = newName

                // Now that names have changed, we must
                // research this branch
                findFreeVariables(binder)
                findBoundVariables(binder)

                console.log("Submitting next alpha")
                displayNextAlpha(i + 1)
            }
        }
    }

    /*
    bindersToRename.forEach(
        binder => alert("Rename " + binder.formalParameter.name + " but don't use " + findVariablesInScope(binder))
    )
    */

    //if (bindersToRename.length) {
    //    alphaConvBox.classList.add('visible')

        /*
        alphaConvList.replaceWith(
            ...bindersToRename.map(binder => {
                const listEl = document.createElement('LI')
                const varEl = document.createElement('SPAN')
                const arrowEl = document.createElement('SPAN')
                const inputEl = document.createElement('INPUT')

                varEl.textContent = binder.formalParameter.name
                arrowEl.innerHTML = `${RIGHT_ARROW_CHAR}<sup>${ALPHA_CHAR}</sup>`

                inputEl.classList.add('invalid')

                
                // TODO: use .append over .appendChild everywhere, not just here
                listEl.append(varEl, arrowEl, inputEl)
            })
        )
        */
    //}

    // Now, make a log of what the reduction was by cloning the current HTML structure
    // The `true` parameter means the cloning is deep
}

function deepClone(rootNode) {
    if (rootNode === null) return;

    const newRootNode = {}
    const doNotClone = ["HTMLElement", "freeVariables", "binders"]

    for (let key in rootNode) {
        // TODO: freeVariables doesn't need to be recomputed each time
        // (though it does need to be deep cloned in any case)
        if (doNotClone.includes(key)) continue;
        
        if (typeof rootNode[key] === 'object' && rootNode.hasOwnProperty(key)) {
            newRootNode[key] = deepClone(rootNode[key])
        } else {
            newRootNode[key] = rootNode[key]
        }
    }

    return newRootNode
}

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

function betaReduce(redex) {
    // TODO: consider keeping a reference to the parent instead, to more easily mutate the rootNode

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
    let currentNumber = ""

    for (let i = 0; i < str.length; i++) {
        if ("0" <= str[i] && str[i] <= "9") {
            currentNumber += str[i]
            continue
        } else if (currentNumber) {
            tokens.push({ type: BASIC.NUMBER, value: +currentNumber })
            currentNumber = ""
        }

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
                // Ignore whitespace, detect numbers, but treat everything else as a variable
                if (/\S/.test(str[i])) {
                    tokens.push({ type: BASIC.VARIABLE, name: str[i] })
                }
        }
    }

    if (currentNumber) {
        tokens.push({ type: BASIC.NUMBER, value: +currentNumber })
    }

    return tokens
}

function handleInput(str, errMsg) {
    const tokenized = tokenize(str)

    try {
        errMsg.textContent = ""
        const parsed = parseAll(tokenized)
        return parsed
    } catch (e) {
        errMsg.textContent = e.message
    }
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

let lastHighlightedRedex = null

function findIntersection(node, ...args) {
    const [x, y, cb] = args

    // TODO: in principle, we should know which half of the tree the relevant
    // node will be so only need to search O(log n) nodes rather than O(n) nodes
    if (!node) return false;

    if (x < node.canvasX + node.canvasRadius &&
        x > node.canvasX - node.canvasRadius &&
        y < node.canvasY + node.canvasRadius &&
        y > node.canvasY - node.canvasRadius
    ) {
        console.log('Found')
        cb(node)
        return true
    } else {
        node.HTMLElement.classList.remove('highlighted')
        
        return findIntersection(node.body, ...args)
            || findIntersection(node.abstraction, ...args)
            || findIntersection(node.argument, ...args)
            || findIntersection(node.formalParameter, ...args)
    }
}

function canvasMouse(x, y, rootNode) {
    const didFind = findIntersection(rootNode, x, y, node => {
        if (isBetaRedex(node)) {
            highlightRedex(lastHighlightedRedex = node)
        } else {
            if (lastHighlightedRedex) {
                unhighlightRedex(lastHighlightedRedex)
                lastHighlightedRedex = null
            }

            node.HTMLElement.classList.add('highlighted')
        }
    })

    if (!didFind) {
        if (lastHighlightedRedex) {
            unhighlightRedex(lastHighlightedRedex)
            lastHighlightedRedex = null
        }
    }
}

function canvasClick(x, y, rootNode, logEl, alphaElements) {
    findIntersection(rootNode, x, y, node => {
        if (!isBetaRedex(node)) {
            return;
        }

        handleReduction(rootNode, node, logEl, alphaElements)
        lastHighlightedRedex = null
    })
}
