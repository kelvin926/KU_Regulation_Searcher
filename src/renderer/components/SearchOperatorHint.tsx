export function SearchOperatorHint() {
  return (
    <p className="search-help">
      검색 연산자: 띄어쓰기는 모두 포함, <code>"정확한 문구"</code>, <code>휴학 OR 복학</code>,{" "}
      <code>-군입대</code> 또는 <code>NOT 군입대</code>로 제외할 수 있습니다.
    </p>
  );
}
