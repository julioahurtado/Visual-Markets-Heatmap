// Utility fucntions needed for heatmap-element


export function Max2D(arr){
    let currMax = Number.NEGATIVE_INFINITY;
    for(var i = 0; i < arr.length; i++){
        for(var j = 0; j < arr[i].length; j++){
            if(currMax < arr[i][j]){
                currMax = arr[i][j];
            }
        }
    }

    return currMax;
}