const LEAF_TAGS = {
    VARIABLE: Symbol("VARIABLE"),
    OPENING_BRACKET: Symbol("OPENING BRACKET"),
    CLOSING_BRACKET: Symbol("CLOSING BRACKET"),
    LAMBDA_TOKEN: Symbol("LAMBDA TOKEN"),
    DOT_TOKEN: Symbol("DOT TOKEN")
}

const ABSTRACTION = Symbol("ABSTRACTION")
const APPLICATION = Symbol("APPLICATION")

function parse(tokens, start = 0, end = tokens.length) {
    // Finds the brackets in the token list, and
    // parses each bracket individually before recombining.
    
    const openingBracketStack = [];
    let inLambda = false;

    const parsedTokens = [];
    
    for (let i = start; i < end; i++) {
        switch (tokens[i].type) {
            case LEAF_TAGS.OPENING_BRACKET:
                openingBracketStack.push(i)
                break
            
            case LEAF_TAGS.CLOSING_BRACKET:
                if (openingBracketStack.length === 0) {
                    throw new Error(`Closing bracket at position ${i} was not opened`)
                } else {
                    const startOfBracket = openingBracketStack.pop() + 1
                    const endOfBracket = i;
                    parsedTokens.push(...parse(startOfBracket, endOfBracket));
                }

                break;
            
            case LEAF_TAGS.LAMBDA_TOKEN:
                if (inLambda) {
                    throw new Error(`Two lambda symbols without a dot between them (at positions ${lastLambda}, ${i})`);
                } else {
                    inLambda = true;
                }
               
               break;

            case LEAF_TAGS.DOT_TOKEN:
                if (!inLambda) {
                    throw new Error(`Dot at ${i} not preceded by lambda symbol`);
                } else {
                    inLambda = false;
                }

            case LEAF_TAGS.VARIABLE:
                if (inLambda) {
                    // Formal parameter
                    
                }
        }
    }
}

// TODO: the close bracket should get additional responsibility to do with handling all outstanding lambdas
// that have been pushed into a stack. Idk maybe we can simulate the recursion? Or maybe we can make bracket parsing a
// totally separate step to other types of parsing?
