import { db } from './firebase-config.js';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentBoardId = new URLSearchParams(window.location.search).get('bbs');
let activeNodeId = null;

// 1. 트리 렌더링 함수
function renderTree(nodes, parentId = null, container = document.getElementById('tree-root')) {
    container.innerHTML = '';
    const filtered = nodes.filter(n => n.parentId === parentId).sort((a, b) => a.order - b.order);

    filtered.forEach(node => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.dataset.id = node.id;
        item.innerHTML = `
            <div class="node-row ${activeNodeId === node.id ? 'active' : ''}" onclick="selectNode('${node.id}')">
                <i class="fas fa-grip-lines node-handle"></i>
                <span class="node-title">${node.title}</span>
                <i class="fas fa-plus-circle" onclick="addNewNode('${node.id}')" style="margin-left:auto"></i>
            </div>
            <div class="sub-tree" data-parent="${node.id}"></div>
        `;
        container.appendChild(item);
        
        // 재귀 호출: 하위 노드 렌더링
        renderTree(nodes, node.id, item.querySelector('.sub-tree'));
    });

    // 드래그 앤 드롭 활성화
    new Sortable(container, {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        handle: '.node-handle',
        onEnd: function (evt) {
            const nodeId = evt.item.dataset.id;
            const newParentId = evt.to.dataset.parent || null;
            updateNodeOrder(nodeId, newParentId, evt.newIndex);
        }
    });
}

// 2. 노드 추가 (이름 중복 체크 포함)
async function addNewNode(parentId) {
    const title = prompt("새 노드 이름을 입력하세요:");
    if (!title) return;

    // TODO: 현재 게시판 내 노드 제목 중복 체크 로직 (Firestore 조회)
    
    const newNodeRef = doc(collection(db, "atoms"));
    await setDoc(newNodeRef, {
        boardId: currentBoardId,
        parentId: parentId,
        title: title,
        content: "",
        order: Date.now()
    });
}

// 3. 드래그 후 데이터 업데이트
async function updateNodeOrder(nodeId, newParentId, newIndex) {
    const nodeRef = doc(db, "atoms", nodeId);
    await updateDoc(nodeRef, {
        parentId: newParentId,
        order: newIndex // 실제 운영 환경에서는 앞뒤 노드의 order 중간값을 계산하는 것이 좋습니다.
    });
}

// 4. 내용 표시 및 마크다운 렌더링
window.selectNode = async function(nodeId) {
    activeNodeId = nodeId;
    // UI 업데이트 및 Firestore에서 content 로드 후 marked.parse() 처리
}
