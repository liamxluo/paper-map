/* ===================== seed ===================== */
function buildSeed(){
  const topics = [{id:'main', name:'My reading list', desc:'', subs:[{id:'main-s', name:'My reading list', desc:'', groups:[], hidden:true}]}];
  return {v:1, topics, entries:{}, links:[], tags: defaultTags(), updatedAt:0};
}
