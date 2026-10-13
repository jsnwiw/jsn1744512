// 대한민국 인프라 분석 지도 애플리케이션 코어 로직
// 1. 구글 초고화질 위성 + 도로명·지번만 표시 (단일 하이브리드 스트림으로 회색 배경 없이 완벽 렌더링)
    const googleCleanSatelliteLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=ko&apistyle=s.t:2|p.v:off', {
      subdomains: '0123',
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    });

    // 2. 순수 구글 위성 사진 (라벨 없음)
    const googleSatBaseLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      subdomains: '0123',
      maxZoom: 20,
      attribution: '&copy; Google Maps'
    });

    // 3. 일반 도로 지도 (OpenStreetMap)
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    // 대한민국 영토 전용 경계 좌표 (남단 마라도~북단 휴전선, 서단 백령도~동단 독도)
    const koreaBounds = L.latLngBounds(
      [33.0, 124.5], // 남서단 (마라도 남측 해역, 백령도 서측)
      [38.7, 131.9]  // 북동단 (휴전선 접경 북측, 독도 동측)
    );

    const map = L.map('map', {
      center: [35.9, 127.8],
      zoom: 7,
      minZoom: 6.8,
      maxZoom: 20,
      zoomSnap: 0.2,
      maxBounds: koreaBounds,
      maxBoundsViscosity: 1.0, // 대한민국 영역 밖으로 화면 이탈 100% 방지 및 탄성 고정
      layers: [googleCleanSatelliteLayer]
    });

    // 최초 로드 시 대한민국 전역에 완벽히 맞춤
    map.fitBounds(koreaBounds);

    // 베이스 레이어 전환 컨트롤
    const baseMaps = {
      "🛰️ 구글 위성 + 도로명·지번만 (시설 핀 없음)": googleCleanSatelliteLayer,
      "🌍 순수 구글 위성 (글씨 없음)": googleSatBaseLayer,
      "🗺️ 일반 도로 지도": osmLayer
    };

    L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

    // 지도 레이어 전환 시 부드러운 애니메이션 및 다이내믹 토스트 발동
    let toastTimer = null;
    function showLayerToast(layerName) {
      const toastEl = document.getElementById('layerToast');
      const textEl = document.getElementById('layerToastText');
      if (!toastEl || !textEl) return;

      textEl.textContent = `${layerName} 모드로 전환되었습니다`;
      toastEl.classList.add('show');

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
      }, 2000);
    }

    map.on('baselayerchange', (e) => {
      // 1. 타일 컨테이너 부드러운 줌·블러·크로스페이드 애니메이션
      const tilePane = map.getPane('tilePane');
      if (tilePane) {
        tilePane.classList.remove('tile-switching-anim');
        void tilePane.offsetWidth; // Force Reflow
        tilePane.classList.add('tile-switching-anim');
      }

      // 2. 조명 스캔 플래시 이펙트
      const flashEl = document.getElementById('mapFlashEffect');
      if (flashEl) {
        flashEl.classList.remove('active');
        void flashEl.offsetWidth; // Force Reflow
        flashEl.classList.add('active');
      }

      // 3. 다이내믹 아일랜드 토스트 알림
      showLayerToast(e.name);
    });

    // 기기 화면 회전 또는 브라우저 창 크기 변경 시 지도 타일 즉시 자동 재배치
    window.addEventListener('resize', () => map.invalidateSize());
    window.addEventListener('orientationchange', () => setTimeout(() => map.invalidateSize(), 300));

    let searchMarker = null;

    function handleSearch() {
      const query = document.getElementById('searchInput').value.trim();
      if (!query) {
        showResult('검색어를 입력해주세요. (예: 영양군, 신안군, 태백시, 의성군, 무주군)', false);
        return;
      }

      if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
      }

      const found = allRegions.find(item => 
        item.name.includes(query) || item.keywords.some(k => k === query || query.includes(k) || k.includes(query))
      );

      if (found) {
        map.flyTo([found.lat, found.lng], found.level, { duration: 1.2 });

        const isAlert = found.infraStatus === "심각" || found.infraStatus === "위험";
        const shortName = found.name.split(" ").slice(-1)[0];
        const popFormatted = found.pop >= 10000 
          ? (found.pop / 10000).toFixed(1) + "만" 
          : found.pop.toLocaleString();

        const badgeHtml = `
          <div class="pop-marker-badge ${isAlert ? 'alert' : ''}">
            📍 ${shortName} <span class="num">${popFormatted}명</span>
          </div>
        `;

        const customIcon = L.divIcon({
          className: 'pop-custom-div-icon',
          html: badgeHtml,
          iconSize: [0, 0]
        });

        searchMarker = L.marker([found.lat, found.lng], { icon: customIcon }).addTo(map);

        const statusClass = (found.infraStatus === "심각") ? "alert" : (found.infraStatus === "위험" ? "warning" : "");

        const popupHtml = `
          <div class="pop-card">
            <div class="pop-header">
              <h3>📍 ${found.name}</h3>
            </div>
            
            <div class="stat-badge">
              <span>인구수:</span>
              <span class="num">${found.pop.toLocaleString()}</span>
              <span>명</span>
            </div>

            ${found.infraStatus ? `
              <div class="infra-score-bar">
                <span>인프라 취약등급:</span>
                <b style="color: ${found.infraStatus === '심각' ? '#ef4444' : (found.infraStatus === '위험' ? '#f59e0b' : '#10b981')}">${found.infraStatus} (${found.score || ''})</b>
              </div>

              <div class="infra-tags">
                ${found.medical ? `<span class="infra-tag ${statusClass}">🏥 ${found.medical}</span>` : ''}
                ${found.traffic ? `<span class="infra-tag ${statusClass}">🚆 ${found.traffic}</span>` : ''}
                ${found.education ? `<span class="infra-tag education">📚 ${found.education}</span>` : ''}
                ${found.culture ? `<span class="infra-tag culture">🎭 ${found.culture}</span>` : ''}
                ${found.fire ? `<span class="infra-tag fire">🚒 ${found.fire}</span>` : ''}
                ${found.welfare ? `<span class="infra-tag welfare">🏠 ${found.welfare}</span>` : ''}
                ${found.digital ? `<span class="infra-tag digital">📡 ${found.digital}</span>` : ''}
                ${found.water ? `<span class="infra-tag water">💧 ${found.water}</span>` : ''}
                ${found.energy ? `<span class="infra-tag energy">⚡ ${found.energy}</span>` : ''}
                ${found.living ? `<span class="infra-tag living">🛒 ${found.living}</span>` : ''}
                ${found.environment ? `<span class="infra-tag environment">🌲 ${found.environment}</span>` : ''}
                ${found.job ? `<span class="infra-tag job">💼 ${found.job}</span>` : ''}
              </div>
            ` : ''}

            <p class="desc">${found.desc}</p>
          </div>
        `;
        searchMarker.bindPopup(popupHtml).openPopup();

        showResult(`📍 <b>${found.name}</b> [등록 인구수: <b>${found.pop.toLocaleString()} 명</b> | 인프라 상태: <span style="color:${found.infraStatus === '심각' ? '#b91c1c' : '#b45309'}">${found.infraStatus || '양호'}</span>]`, true);
      } else {
        showResult(`❌ <b>'${query}'</b> 검색 결과를 찾을 수 없습니다. (예: 영양군, 신안군, 태백시, 의성군, 무주군 등을 입력해보세요)`, false);
      }
    }

    function quickSearch(keyword) {
      document.getElementById('searchInput').value = keyword;
      closeAutocomplete();
      handleSearch();
    }

    function resetMap() {
      document.getElementById('searchInput').value = '';
      closeAutocomplete();
      document.getElementById('resultInfo').style.display = 'none';
      if (searchMarker) {
        map.removeLayer(searchMarker);
        searchMarker = null;
      }
      // 인프라 마커 + 필터 탭 초기화
      if (infraMarkers) infraMarkers.clearLayers();
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.infra-panel').forEach(p => p.classList.remove('open'));
      map.closePopup();
      map.fitBounds(koreaBounds, { animate: true, duration: 1.0 });
    }

    function showResult(html, isSuccess) {
      const box = document.getElementById('resultInfo');
      box.style.display = 'block';
      box.className = 'status-dynamic ' + (isSuccess ? 'success' : 'fail');
      box.innerHTML = html;
    }

    // 인프라 카테고리별 마커 레이어
    let infraMarkers = L.layerGroup().addTo(map);

    // 카테고리 → 데이터 필드 매핑
    const catFieldMap = {
      medical: 'medical', traffic: 'traffic', education: 'education',
      culture: 'culture', fire: 'fire', welfare: 'welfare',
      digital: 'digital', water: 'water', energy: 'energy',
      living: 'living', environment: 'environment', job: 'job',
      danger: 'infraStatus'
    };

    function buildPopupHtml(r) {
      const statusClass = (r.infraStatus === "심각") ? "alert" : (r.infraStatus === "위험" ? "warning" : "");
      return `
        <div class="pop-card">
          <div class="pop-header"><h3>📍 ${r.name}</h3></div>
          <div class="stat-badge">
            <span>인구수:</span>
            <span class="num">${r.pop.toLocaleString()}</span>
            <span>명</span>
          </div>
          ${r.infraStatus ? `
            <div class="infra-score-bar">
              <span>인프라 취약등급:</span>
              <b style="color: ${r.infraStatus === '심각' ? '#ef4444' : (r.infraStatus === '위험' ? '#f59e0b' : '#10b981')}">${r.infraStatus} (${r.score || ''})</b>
            </div>
            <div class="infra-tags">
              ${r.medical ? `<span class="infra-tag ${statusClass}">🏥 ${r.medical}</span>` : ''}
              ${r.traffic ? `<span class="infra-tag ${statusClass}">🚆 ${r.traffic}</span>` : ''}
              ${r.education ? `<span class="infra-tag education">📚 ${r.education}</span>` : ''}
              ${r.culture ? `<span class="infra-tag culture">🎭 ${r.culture}</span>` : ''}
              ${r.fire ? `<span class="infra-tag fire">🚒 ${r.fire}</span>` : ''}
              ${r.welfare ? `<span class="infra-tag welfare">🏠 ${r.welfare}</span>` : ''}
              ${r.digital ? `<span class="infra-tag digital">📡 ${r.digital}</span>` : ''}
              ${r.water ? `<span class="infra-tag water">💧 ${r.water}</span>` : ''}
              ${r.energy ? `<span class="infra-tag energy">⚡ ${r.energy}</span>` : ''}
              ${r.living ? `<span class="infra-tag living">🛒 ${r.living}</span>` : ''}
              ${r.environment ? `<span class="infra-tag environment">🌲 ${r.environment}</span>` : ''}
              ${r.job ? `<span class="infra-tag job">💼 ${r.job}</span>` : ''}
            </div>
          ` : ''}
          <p class="desc">${r.desc}</p>
        </div>
      `;
    }

    function filterInfra(cat) {
      const tabs = document.querySelectorAll('.filter-tab');
      const panels = document.querySelectorAll('.infra-panel');
      const clickedTab = document.querySelector(`.filter-tab[data-cat="${cat}"]`);
      const targetPanel = document.getElementById('panel-' + cat);
      const isOpen = clickedTab.classList.contains('active');

      // 모든 탭 비활성 + 패널 닫기
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('open'));

      // 기존 인프라 마커 제거
      infraMarkers.clearLayers();
      if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }

      // 같은 탭 재클릭이면 닫기만 (토글)
      if (isOpen) {
        map.fitBounds(koreaBounds, { animate: true, duration: 0.8 });
        showResult('', false);
        document.getElementById('resultInfo').style.display = 'none';
        return;
      }

      clickedTab.classList.add('active');
      targetPanel.classList.add('open');

      // 해당 카테고리 데이터 필터링
      const field = catFieldMap[cat];
      const matched = allRegions.filter(r => {
        if (cat === 'danger') return r.infraStatus === '심각' || r.infraStatus === '위험';
        return r[field] && r.infraStatus;
      });

      // 마커 생성 + 지도에 추가
      const bounds = [];
      const catIcons = {
        medical: '🚨', traffic: '🚆', education: '📚',
        culture: '🎭', fire: '🚒', welfare: '🏠',
        digital: '📡', water: '💧', energy: '⚡',
        living: '🛒', environment: '🌲', job: '💼',
        danger: '📉'
      };
      const catColors = {
        medical: '#dc2626', traffic: '#ea580c', education: '#4338ca',
        culture: '#7c3aed', fire: '#c2410c', welfare: '#0f766e',
        digital: '#0e7490', water: '#0284c7', energy: '#eab308',
        living: '#14b8a6', environment: '#15803d', job: '#475569',
        danger: '#4b5563'
      };

      matched.forEach(r => {
        const isAlert = r.infraStatus === "심각" || r.infraStatus === "위험";
        const shortName = r.name.split(" ").slice(-1)[0];
        const popFormatted = r.pop >= 10000 
          ? (r.pop / 10000).toFixed(1) + "만" 
          : r.pop.toLocaleString();

        const badgeHtml = `
          <div class="pop-marker-badge ${isAlert ? 'alert' : ''}" style="border-color: ${catColors[cat]}">
            ${catIcons[cat]} ${shortName} <span class="num" style="color: ${catColors[cat]}">${popFormatted}명</span>
          </div>
        `;

        const icon = L.divIcon({
          className: 'pop-custom-div-icon',
          html: badgeHtml,
          iconSize: [0, 0]
        });

        const marker = L.marker([r.lat, r.lng], { icon }).addTo(infraMarkers);
        marker.bindPopup(buildPopupHtml(r), { maxWidth: 320 });
        bounds.push([r.lat, r.lng]);
      });

      // 전체 마커가 보이도록 지도 범위 조정
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 1.0 });
      }

      const catNames = {
        medical: '응급의료', traffic: '교통/철도', education: '교육',
        culture: '문화/체육', fire: '소방/안전', welfare: '복지/돌봄',
        digital: '통신/디지털', water: '상수도/수자원', energy: '에너지/난방',
        living: '생활/상권', environment: '환경/생태', job: '일자리/산업',
        danger: '소멸위험'
      };
      showResult(`${catIcons[cat]} <b>${catNames[cat]} 소외</b> 취약 지자체 <b>${matched.length}개</b> 표시 중 — 마커를 클릭하면 상세 정보를 볼 수 있습니다`, true);
    }

    // ── 실시간 자동완성 추천 검색 기능 ──
    let selectedAutocompleteIdx = -1;

    function handleInputAutocomplete(val) {
      const listEl = document.getElementById('autocompleteList');
      const query = val.trim().toLowerCase();
      selectedAutocompleteIdx = -1;

      if (!query) {
        listEl.style.display = 'none';
        listEl.innerHTML = '';
        return;
      }

      // 이름 및 키워드 기반 매칭 (최대 7개)
      const matches = allRegions.filter(item => {
        return item.name.toLowerCase().includes(query) || 
               item.keywords.some(k => k.toLowerCase().includes(query));
      }).slice(0, 7);

      if (matches.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 10px 14px; font-size: 13px; color: #86868b; text-align: center;">
            일치하는 지역이 없습니다
          </div>
        `;
        listEl.style.display = 'block';
        return;
      }

      const html = matches.map((m, idx) => {
        // 검색어 하이라이트
        const regex = new RegExp(`(${query})`, 'gi');
        const highlightedName = m.name.replace(regex, '<span class="highlight">$1</span>');
        const popFormatted = m.pop >= 10000 
          ? (m.pop / 10000).toFixed(1) + '만' 
          : m.pop.toLocaleString();
        const isAlert = m.infraStatus === '심각' || m.infraStatus === '위험';

        return `
          <div class="autocomplete-item" data-idx="${idx}" onclick="selectAutocomplete('${m.name}')">
            <span>📍 ${highlightedName}</span>
            <div class="item-meta">
              ${m.infraStatus ? `<span class="item-badge ${isAlert ? 'alert' : ''}">${m.infraStatus}</span>` : ''}
              <span>${popFormatted}명</span>
            </div>
          </div>
        `;
      }).join('');

      listEl.innerHTML = html;
      listEl.style.display = 'block';
    }

    function selectAutocomplete(name) {
      const input = document.getElementById('searchInput');
      input.value = name;
      closeAutocomplete();
      handleSearch();
    }

    function closeAutocomplete() {
      const listEl = document.getElementById('autocompleteList');
      if (listEl) {
        listEl.style.display = 'none';
        listEl.innerHTML = '';
      }
      selectedAutocompleteIdx = -1;
    }

    function handleKeyNavigation(e) {
      const listEl = document.getElementById('autocompleteList');
      const items = listEl.querySelectorAll('.autocomplete-item');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items.length === 0) return;
        selectedAutocompleteIdx = (selectedAutocompleteIdx + 1) % items.length;
        updateItemHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (items.length === 0) return;
        selectedAutocompleteIdx = (selectedAutocompleteIdx - 1 + items.length) % items.length;
        updateItemHighlight(items);
      } else if (e.key === 'Enter') {
        if (selectedAutocompleteIdx >= 0 && items[selectedAutocompleteIdx]) {
          e.preventDefault();
          items[selectedAutocompleteIdx].click();
        } else {
          closeAutocomplete();
          handleSearch();
        }
      } else if (e.key === 'Escape') {
        closeAutocomplete();
      }
    }

    function updateItemHighlight(items) {
      items.forEach((item, idx) => {
        if (idx === selectedAutocompleteIdx) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
          // 입력창 텍스트 미리보기 (옵션)
        } else {
          item.classList.remove('selected');
        }
      });
    }

    // 바깥 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
      const dock = document.querySelector('.search-glass-pill');
      if (dock && !dock.contains(e.target)) {
        closeAutocomplete();
      }
    });
