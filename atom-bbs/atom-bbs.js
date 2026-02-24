// 1. URL 파라미터 분석
const urlParams = new URLSearchParams(window.location.search);
const boardId = urlParams.get('bbs'); // null이면 신규 생성

// 2. 트리 노드 생성 로직 (예시)
function createNode(parentId = null, level = 0) {
    const title = prompt("노드 제목을 입력하세요:");
    if(!title) return;
    
    const newNode = {
        boardId: boardId,
        parentId: parentId,
        title: title,
        content: "", // 초기 마크다운 내용
        order: Date.now() // 순서 정렬용
    };
    // Firebase Firestore에 저장 후 트리 리로드
    db.collection("atoms").add(newNode);
}

// 3. 마크다운 렌더링 (marked.js 사용)
function renderPreview(markdownText) {
    const previewArea = document.getElementById('preview');
    previewArea.innerHTML = marked.parse(markdownText);
}
