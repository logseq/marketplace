/**
 * User model
 */

function createModel () {
  return {
    openMindMapPlus () {
      logseq.showMainUI()
    },
  }

}
// 定义一个main函数，
function main () {
  logseq.provideStyle(` 
    @import url("https://at.alicdn.com/t/c/font_4811351_lkgrsodjsj8.css");
 `)  //引入一个样式，样式文件存放在url所写的地址上.  
 
  logseq.setMainUIInlineStyle({
    position: 'fixed',
    zIndex: 12,
  }) //设置logseq主UI的行内样式？

  logseq.App.registerUIItem('pagebar', {
    key: 'another-open-mind-plus', //注册UI组件到页面菜单
    template: `
    <a data-on-click="openMindMapPlus" title="open mind map plus"> 
      <i class="iconfont icon-MINDMAPPING" style="font-size: 20px; line-height: 1em;"></i> 
    </a>
   `,
  }) 
  // main ui
  const root = document.querySelector('#app')
  const btnClose = document.createElement('button')
  const displayMap = document.createElement('div')
  let mindMap,blocks,page

  // events
  displayMap.id = 'map'
  displayMap.classList.add('mind-display', 'hidden')
  btnClose.textContent = 'CLOSE'
  btnClose.classList.add('close-btn')

  btnClose.addEventListener('click', async () => {  
    try{
      await syncMindMapToLogseq(mindMap,blocks,page);
    } catch(error){
      console.error("函数运行有错误:",error) 
    }   
    logseq.hideMainUI() 
  }, false)

  document.addEventListener('keydown', async function (e) {
    if (e.keyCode === 27) {  
      try{
        await syncMindMapToLogseq(mindMap,blocks,page);
        // console.log("mindMap:",mindMap) //调试代码用。
      } catch(error){
        console.error("函数运行有错误:",error) 
      }     
      logseq.hideMainUI()
    }
  }, false)


  logseq.on('ui:visible:changed', async ({ visible }) => {
    if (!visible) {
      displayMap.classList.add('hidden')
    } else {
      blocks = await logseq.Editor.getCurrentPageBlocksTree()
      page = await logseq.Editor.getCurrentPage()
      mindMap = initMindMap(displayMap, btnClose, blocks,page) 
    }
  })
  // mount to root
  root.append(displayMap)  
}

/**
 * @param el
 * @param btnClose
 * @param data
 */
function initMindMap (el,btnClose, data,page) {
  const pageUuid = page.uuid
  const root = {
    id: pageUuid, 
    topic: '📖',
    root: true,
    expanded: true,
    children: [],
  }

  // 尝试修改一段代码
  try {
    if (page) {   
      root.topic += page.name.replace('📖','')
    }
  } catch (e) {
    console.debug(e)
  }

  const walkTransformBlocks = (blocks, depth = 0) => {
    return blocks.map((it) => {
      const { children, uuid, content} = it;
      const collapsed =it['collapsed?'];
      const ret = {
        id: uuid, 
        topic:content?content:"no name yet", // title?.[0]?.[1],
        selected: true, 
        new: true, 
        direction: depth, 
        expanded:!collapsed, 
      }
      if (children) {
        ret.children = walkTransformBlocks(children, ++depth) // 如果有子节点的话，递归调用这个函数方法（depth要提前+1）
      }
      return ret
    })
  }
  root.children = walkTransformBlocks(data)
  console.debug(root)

  // el.textContent = JSON.stringify(root, null, 2)
  let options = {
    el: '#map',
    direction: MindElixir.RIGHT,
    // create new map data
    // data: MindElixir.new('new topic'),
    // the data return from `.getAllData()`
    data: { nodeData: root },
    draggable: true, // default true
    contextMenu: true, // default true
    toolBar: true, // default true
    nodeMenu: false, // default true
    editable: true,
    keypress: true, // default true
    locale: 'zh_CN', // [zh_CN,zh_TW,en,ja] waiting for PRs
    overflowHidden: true, // default false
    primaryLinkStyle: 2, // [1,2] default 1
    primaryNodeVerticalGap: 15, // default 25
    primaryNodeHorizontalGap: 15, // default 65
    contextMenuOption: {
      focus: false,
      link: false,
    },
  }
  let mind = new MindElixir(options)   
  mind.init()

  const patchRightBottomBar = () => {
    const barWrap = document.querySelector('toolbar.rb')
    barWrap.appendChild(btnClose)
  }

  setTimeout(() => {
    patchRightBottomBar()
    mind.initSide()
    el.classList.remove('hidden')
  }, 16)
  return mind
}

async function syncMindMapToLogseq(mindMap,blocks,page){
  const mindNodes = mindMap.nodeData.children
  const mindHistories = mindMap.history
  const pageName = mindMap.nodeData.topic? mindMap.nodeData.topic : "未命名思维导图"
  if(page.name !== pageName){
    logseq.Editor.renamePage(page.name,pageName)  
  } 
  await nodeUpdateToBlock(mindNodes,blocks);  
  removeBlockFromMindHistories(mindHistories);
}

async function removeBlockFromMindHistories(mindHistories){
  for (const history of mindHistories) {
      if (history.name === "removeNode") {
        const blockIdToRemove = history.obj.id;
        try {
          await logseq.Editor.removeBlock(blockIdToRemove);
        } catch (error) {
          console.error("删除出错：",error);
        }
      }
  }    
}

function searchNodeFromBlocks(blocks,mindNode){
  let searchResult
  const mindNodeId = mindNode.id
  const buildBlocksMap = (blocks,blocksMap ={}) =>{
    blocks.forEach(block =>{
      blocksMap[block.uuid] = block; //使用block.id作为主键构建blocksMap地图映射
      if(block.children.length>0){
        buildBlocksMap(block.children,blocksMap) //递归处理子块
      }  
    })
    return blocksMap
  }
  let blocksMap = buildBlocksMap(blocks)

  if(blocksMap[mindNodeId]){
    searchResult = true
  } else {
    searchResult = false  
  }
  return searchResult
}

async function nodeUpdateToBlock(mindNodes,blocks){ 
  for(i=0;i<mindNodes.length;i++){
    let mindNode = mindNodes[i]        
    let blockUuid = mindNode.id
    let parentUuid = mindNode.parent.id
    const nodeTopic = mindNode.topic
    let searchResult = searchNodeFromBlocks(blocks,mindNode)

    if(searchResult){   //如果在blocks中找到本mindNode的id对应的block。
      try {
        await logseq.Editor.updateBlock(blockUuid, nodeTopic);
      } catch (error){
        console.error("更新节点时出错：",error)
      }

    } else {
      try {
        const newBlock = await logseq.Editor.insertBlock(parentUuid, nodeTopic, {sibling:false,}) //'collapsed?': !mindNode.expanded
        mindNode.id = newBlock.uuid
        blockUuid = newBlock.uuid       
      } catch (error) {
        console.error("新增节点时出错：",error)
      }
    } 

    if (i === 0) { //如果是页面的第一个节点。
        const pageFirstBlockId=blocks[0].uuid //获取页面原来的第一个block
        if(blockUuid !== pageFirstBlockId){
          await logseq.Editor.moveBlock(blockUuid, pageFirstBlockId, { before:true, children: false});
        }                    
    } else { //如果不是页面的第一个节点
        const mindNodePreviousUuid = mindNodes[i-1].id
        await logseq.Editor.moveBlock(blockUuid, mindNodePreviousUuid, { before:false,children: false });
    }
    await logseq.Editor.setBlockCollapsed(blockUuid,!mindNode.expanded) 

    if(mindNode.children){      
      const children = mindNode.children
      if(children.length>0){
        await nodeChildrenUpdateToBlock(children,blocks)   
      }
    } 
  }
}

async function nodeChildrenUpdateToBlock(children,blocks) {
  for(j=0;j<children.length;j++){
    let child = children[j]
    let searchResult = searchNodeFromBlocks(blocks,child)        
    let blockUuid = child.id
    let parentUuid = child.parent.id
    const childTopic = child.topic
    if(searchResult){   //如果在blocks中找到本mindNode的id对应的block（用uuid做标识）
      try {
        await logseq.Editor.updateBlock(blockUuid, childTopic); // !child.expanded ,{collapsed:true }
      } catch (error){
        console.error("更新节点时出错：",error)
      }
 
    } else {
      try {
        const newBlock = await logseq.Editor.insertBlock(parentUuid, childTopic, {sibling:false}) // ['collapsed?']: !child.expanded
        child.id = newBlock.uuid
        blockUuid = newBlock.uuid  
      } catch (error) {
        console.error("新增节点时出错：",error)
      }
    } 

    if (j === 0) { //如果是children数组的第一个节点。
       await logseq.Editor.moveBlock(blockUuid, parentUuid, { before:false, children: true }); // 对于根接点而言，mindNode.parent.uuid是Page的uuid
        
    } else { //如果不是children数组的第一个节点
        const childPreviousUuid = children[j-1].id
        await logseq.Editor.moveBlock(blockUuid, childPreviousUuid, { before:false,children: false });
    }
    await logseq.Editor.setBlockCollapsed(blockUuid,!child.expanded)

    if(child.children){      
      const children = child.children
      if(children.length>0){
        await nodeChildrenUpdateToBlock(children,blocks)   
      }
    } 
  }  
} 
// bootstrap
logseq.ready(createModel(), main).catch(console.error)
