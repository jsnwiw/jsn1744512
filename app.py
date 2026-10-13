import streamlit as st
import streamlit.components.v1 as components
import os

# 페이지 기본 설정
st.set_page_config(
    page_title="대한민국 인프라 소외지역 지도",
    page_icon="🗺️",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# 커스텀 스타일 적용
st.markdown("""
    <style>
        .main .block-container {
            padding-top: 1rem;
            padding-bottom: 1rem;
            padding-left: 2rem;
            padding-right: 2rem;
            max-width: 100%;
        }
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
    </style>
""", unsafe_allow_html=True)

# index.html (지도 파일) 읽기
html_path = os.path.join(os.path.dirname(__file__), "index.html")

if os.path.exists(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Streamlit 화면 전체에 Leaflet 지도 임베딩 (반응형 높이 880px)
    components.html(html_content, height=880, scrolling=True)
else:
    st.error("index.html 파일을 찾을 수 없습니다.")
