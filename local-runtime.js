/* Local interactions layered over the original Tilda layout. */
(() => {
  'use strict';
  const formPending = new WeakSet();
  const siteBase = document.documentElement.dataset.siteBase || '/';
  const localPath = (file) => siteBase + file;
  const pagePath = location.pathname.slice(siteBase.length - 1).replace(/\/$/, '');
  const kazakhPage = pagePath === '/avenuekz' || pagePath === '/avenuekz.html';

  function materialCards() {
    const section = document.querySelector('#rec2124998913, #rec2147492803');
    if (!section) return;
    const kazakh = section.id === 'rec2147492803';
    const materials = [
      {
        id: '1774576909840', image: 'frame',
        ru: ['Монолитный железобетон', 'Колонны и перекрытия образуют единый несущий каркас здания.', 'Прочная основа, которая воспринимает и распределяет нагрузки.'],
        kz: ['Монолитті темірбетон', 'Бағаналар мен жабындар ғимараттың біртұтас көтергіш қаңқасын құрайды.', 'Жүктемені қабылдап, бөлетін берік негіз.'],
      },
      {
        id: '1774577021942000004', image: 'walls',
        ru: ['Газобетон и кирпич', 'Газобетонные блоки и кирпичная кладка формируют стены здания.', 'Газобетон помогает сохранять тепло, кирпич придаёт кладке прочность.'],
        kz: ['Газобетон мен кірпіш', 'Газобетон блоктары мен кірпіш қалау ғимараттың қабырғаларын құрайды.', 'Газобетон жылуды сақтауға көмектеседі, кірпіш қалауға беріктік береді.'],
      },
      {
        id: '1774577162558000016', image: 'ac-screen',
        ru: ['Корзины кондиционеров', 'Декоративные экраны скрывают наружные блоки и оставляют пространство для вентиляции.', 'Техника аккуратно вписана в фасад и не нарушает его общий облик.'],
        kz: ['Кондиционер себеттері', 'Сәндік экрандар сыртқы блоктарды жасырып, желдетуге орын қалдырады.', 'Техника қасбетке үйлесіп, оның тұтас келбетін сақтайды.'],
      },
      {
        id: '1774577052061000008', image: 'glazing',
        ru: ['Энергосберегающий стеклопакет', 'Герметичный стеклопакет уменьшает теплообмен через окно.', 'Помогает сохранять тепло в помещении и поддерживать комфортную температуру.'],
        kz: ['Энергия үнемдейтін шыныпакет', 'Герметикалық шыныпакет терезе арқылы жылу алмасуын азайтады.', 'Бөлмедегі жылуды сақтап, жайлы температураны қолдауға көмектеседі.'],
      },
      {
        id: '1774577107654000012', image: 'aluminium',
        ru: ['Алюминиевые панели', 'Металлическая облицовка формирует ровные плоскости и чёткие линии фасада.', 'Лёгкий материал с аккуратной фактурой подчёркивает архитектуру здания.'],
        kz: ['Алюминий панельдері', 'Металл қаптама қасбеттің тегіс беттері мен айқын сызықтарын қалыптастырады.', 'Жеңіл материалдың ұқыпты фактурасы ғимарат сәулетін айқындайды.'],
      },
      {
        id: '1775562300542000001', image: 'panoramic',
        ru: ['Панорамные витражи', 'Крупные стеклянные поверхности открывают вид и связывают интерьер с городом.', 'Больше естественного света и ощущение открытого пространства.'],
        kz: ['Панорамалық витраждар', 'Үлкен шыны беттер көріністі ашып, интерьерді қала кеңістігімен байланыстырады.', 'Табиғи жарық көбірек түсіп, кеңістік ашық сезіледі.'],
      },
      {
        id: '1775564426175000004', image: 'lighting',
        ru: ['Архитектурная подсветка', 'Световые акценты выделяют линии, фактуру и объём фасада в вечернее время.', 'Дом сохраняет выразительный облик и создаёт тёплую атмосферу после заката.'],
        kz: ['Архитектуралық жарықтандыру', 'Жарық кешкі уақытта қасбеттің сызықтарын, фактурасын және көлемін айқындайды.', 'Күн батқаннан кейін де үйдің көркем келбеті мен жылы атмосферасы сақталады.'],
      },
    ];
    const card = document.createElement('aside');
    card.id = 'avenue-material-card';
    card.className = 'avenue-material-card';
    card.hidden = true;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-labelledby', 'avenue-material-title');
    card.innerHTML = `
      <div class="avenue-material-photo">
        <img class="avenue-material-image" width="600" height="400" alt="">
        <span class="avenue-material-example">${kazakh ? 'Шешімнің мысалы' : 'Пример решения'}</span>
        <button class="avenue-material-close" type="button" aria-label="${kazakh ? 'Карточканы жабу' : 'Закрыть карточку'}">×</button>
      </div>
      <div class="avenue-material-copy">
        <h3 id="avenue-material-title"></h3>
        <p id="avenue-material-description" class="avenue-material-description"></p>
        <div class="avenue-material-benefit">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10 3 3 7-7"/></svg>
          <p id="avenue-material-benefit"></p>
        </div>
      </div>`;
    document.body.appendChild(card);
    const image = card.querySelector('img');
    const title = card.querySelector('h3');
    const description = card.querySelector('.avenue-material-description');
    const benefit = card.querySelector('.avenue-material-benefit p');
    const closeButton = card.querySelector('button');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const buttons = [];
    let active = null;
    let pinned = false;
    let closeTimer;
    let openTimer;
    let restoringFocus = false;

    function position() {
      if (!active || card.hidden) return;
      const anchor = active.getBoundingClientRect();
      const photo = section.querySelector('[data-elem-id="1774576797286"]')?.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      if (anchor.bottom < 70 || anchor.top > window.innerHeight || anchor.right < 0 || anchor.left > window.innerWidth) {
        hide();
        return;
      }
      card.style.width = Math.min(304, viewportWidth - 32) + 'px';
      const width = card.offsetWidth;
      const height = card.offsetHeight;
      const margin = 16;
      const gap = 12;
      let side = 'right';
      let left = anchor.right + gap;
      if (left + width > viewportWidth - margin) {
        side = 'left';
        left = anchor.left - gap - width;
      }
      left = Math.max(margin, Math.min(left, viewportWidth - width - margin));
      const lower = Math.max(76, (photo?.top ?? 76) + 8);
      const upper = Math.min(window.innerHeight - height - margin, (photo?.bottom ?? window.innerHeight) - height - 8);
      let top = Math.max(Math.min(lower, upper), Math.min(anchor.top - 24, upper));
      if (window.innerWidth <= 640) {
        side = 'bottom';
        left = Math.max(margin, Math.min(anchor.left + anchor.width / 2 - width / 2, viewportWidth - width - margin));
        const footerSpace = window.innerHeight < 600 ? 156 : 220;
        const preferred = anchor.top - height - gap >= 76 ? anchor.top - height - gap : anchor.bottom + gap;
        top = Math.max(76, Math.min(preferred, window.innerHeight - height - footerSpace));
      }
      card.dataset.side = side;
      card.style.left = Math.round(left) + 'px';
      card.style.top = Math.round(Math.max(76, top)) + 'px';
      card.style.setProperty('--avenue-material-arrow', Math.max(20, Math.min(anchor.top + anchor.height / 2 - top, height - 20)) + 'px');
    }

    function hide(restoreFocus = false) {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      const previous = active;
      active = null;
      pinned = false;
      card.hidden = true;
      previous?.setAttribute('aria-expanded', 'false');
      previous?.removeAttribute('aria-describedby');
      if (restoreFocus && previous?.isConnected) {
        restoringFocus = true;
        previous.focus({ preventScroll: true });
        restoringFocus = false;
      }
    }

    function show(button, material) {
      clearTimeout(closeTimer);
      if (active === button && !card.hidden) return;
      active?.setAttribute('aria-expanded', 'false');
      active?.removeAttribute('aria-describedby');
      active = button;
      pinned = false;
      const copy = material[kazakh ? 'kz' : 'ru'];
      image.src = localPath('assets/images/materials/' + material.image + '.jpg');
      image.alt = (kazakh ? 'Мысал: ' : 'Пример: ') + copy[0];
      title.textContent = copy[0];
      description.textContent = copy[1];
      benefit.textContent = copy[2];
      card.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.setAttribute('aria-describedby', 'avenue-material-description avenue-material-benefit');
      position();
    }

    function scheduleHide() {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (!pinned && !card.matches(':hover') && !active?.matches(':hover') && !card.contains(document.activeElement) && document.activeElement !== active) hide();
      }, 180);
    }

    for (const material of materials) {
      const point = section.querySelector(`[data-elem-id="${material.id}"]`);
      const atom = point?.querySelector('.tn-atom');
      if (!atom) continue;
      section.querySelectorAll(`[data-animate-sbs-trgels="${material.id}"]`).forEach(label => {
        label.classList.add('avenue-material-legacy');
        label.setAttribute('aria-hidden', 'true');
      });
      point.classList.add('avenue-material-hotspot');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'avenue-material-trigger';
      button.setAttribute('aria-label', material[kazakh ? 'kz' : 'ru'][0]);
      button.setAttribute('aria-controls', card.id);
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>';
      atom.replaceChildren(button);
      buttons.push(button);
      button.addEventListener('pointerenter', event => {
        if (!finePointer.matches || event.pointerType === 'touch') return;
        clearTimeout(closeTimer);
        clearTimeout(openTimer);
        openTimer = setTimeout(() => show(button, material), 80);
      });
      button.addEventListener('pointerleave', () => { clearTimeout(openTimer); scheduleHide(); });
      button.addEventListener('focus', () => { if (!restoringFocus) show(button, material); });
      button.addEventListener('blur', scheduleHide);
      button.addEventListener('click', () => {
        if (active === button && pinned) hide();
        else { show(button, material); pinned = true; }
      });
      button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          show(button, material);
          pinned = true;
          closeButton.focus({ preventScroll: true });
        }
      });
    }
    if ('IntersectionObserver' in window) {
      const preload = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        materials.forEach(material => { const thumbnail = new Image(); thumbnail.src = localPath('assets/images/materials/' + material.image + '.jpg'); });
        preload.disconnect();
      }, { rootMargin: '200px' });
      preload.observe(section);
    }
    card.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    card.addEventListener('pointerleave', scheduleHide);
    card.addEventListener('focusout', scheduleHide);
    closeButton.addEventListener('click', () => hide(true));
    document.addEventListener('pointerdown', event => {
      if (!card.hidden && !card.contains(event.target) && !buttons.some(button => button.contains(event.target))) hide();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !card.hidden) { event.preventDefault(); hide(card.contains(document.activeElement)); }
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', () => {
      if (!card.hidden) {
        if (pinned || card.contains(document.activeElement)) position();
        else hide();
      }
    }, { passive: true });
  }

  function revealAnimations() {
    const selector = '[data-animate-style]';
    const offsets = {
      fadein: [0, 0], fadeinup: [0, 24], fadeindown: [0, -24],
      fadeinleft: [-24, 0], fadeinright: [24, 0],
    };
    const elements = new Set();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Reveal inside the visible screen, below the fixed header. A separate,
    // larger reset area prevents visible elements from disappearing on reversal.
    const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (reducedMotion.matches || isIntersecting) target.dataset.avenueReveal = 'visible';
      }
    }, { rootMargin: '-64px 0px -24px 0px', threshold: 0 }) : null;
    const resetObserver = observer ? new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting || reducedMotion.matches) continue;
        // Tilda moves its absolute elements during initial layout and resizing.
        // Reject an exit queued before that layout if the element is visible now.
        const bounds = target.getBoundingClientRect();
        if (bounds.bottom < -96 || bounds.top > window.innerHeight + 96) target.dataset.avenueReveal = 'waiting';
        else if (bounds.bottom > 64 && bounds.top < window.innerHeight - 24) target.dataset.avenueReveal = 'visible';
      }
    }, { rootMargin: '96px 0px 96px 0px', threshold: 0 }) : null;

    function register(element) {
      const offset = offsets[element.getAttribute('data-animate-style')];
      if (!offset || elements.has(element)) return;
      elements.add(element);
      // The original Tilda driver delays startup and unobserves after the first
      // reveal. Take ownership of appearance only; hover and SBS loops stay native.
      element.classList.remove('t-animate', 't-animate_wait', 't-animate_started', 't-animate_no-hover');
      element.style.setProperty('--avenue-reveal-x', offset[0] + 'px');
      element.style.setProperty('--avenue-reveal-y', offset[1] + 'px');
      element.classList.add('avenue-reveal');
      element.dataset.avenueReveal = !observer || reducedMotion.matches ? 'visible' : 'waiting';
      observer?.observe(element);
      resetObserver?.observe(element);
    }

    function scan(root) {
      if (root.matches?.(selector)) register(root);
      root.querySelectorAll(selector).forEach(register);
    }
    scan(document);
    // Tilda creates carousel clones after page load; give them the same behavior.
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) if (node.nodeType === 1) scan(node);
      }
    }).observe(document.getElementById('allrecords') || document.body, { childList: true, subtree: true });

    reducedMotion.addEventListener('change', () => {
      for (const element of elements) {
        if (!element.isConnected) {
          elements.delete(element);
          observer?.unobserve(element);
          resetObserver?.unobserve(element);
          continue;
        }
        if (reducedMotion.matches || !observer) element.dataset.avenueReveal = 'visible';
        else {
          observer.unobserve(element); observer.observe(element);
          resetObserver.unobserve(element); resetObserver.observe(element);
        }
      }
    });
  }

  async function submit(form) {
    if (formPending.has(form)) return;
    const api = window.tildaForm;
    if (api) {
      api.hideErrors(form);
      if (api.showErrors(form, api.validate(form))) return;
    } else if (!form.reportValidity()) return;

    const field = (name) => form.querySelector(`[name="${name}"]`);
    const values = {
      name: field('name')?.value || field('Name')?.value || '',
      phone: field('phone')?.value || field('Phone')?.value || '',
      room: field('room')?.value || field('Room')?.value || '',
      consent: Boolean(form.querySelector('input[type="checkbox"]:checked')),
    };
    const button = form.querySelector('[type="submit"]');
    formPending.add(form);
    if (button) { button.disabled = true; button.classList.add('t-btn_sending'); }
    try {
      if (document.documentElement.dataset.staticHost === 'true') {
        throw new Error(kazakhPage
          ? 'Өтінім қалдыру үшін WhatsApp арқылы хабарласыңыз.'
          : 'Чтобы оставить заявку, свяжитесь с нами через WhatsApp.');
      }
      const response = await fetch(localPath('api/leads'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const message = kazakhPage
        ? 'Өтінім осы сайттың жергілікті көшірмесінде сақталды.'
        : 'Ваша заявка сохранена в локальной копии сайта.';
      const box = form.querySelector('.js-successbox');
      if (box) {
        box.textContent = message;
        box.setAttribute('data-success-message', message);
      }
      if (typeof window.t_forms__showSuccessbox === 'function') {
        await window.t_forms__showSuccessbox(form);
      } else if (box) box.style.display = 'block';
      else if (api?.showSuccessPopup) api.showSuccessPopup(message);
      form.classList.add('js-send-form-success');
      form.reset();
    } catch (error) {
      let box = form.querySelector('.replica-error');
      if (!box) {
        box = document.createElement('div');
        box.className = 'replica-error';
        box.style.cssText = 'padding:12px;color:#a52323;font:14px Arial,sans-serif';
        form.appendChild(box);
      }
      box.textContent = error.message || 'Не удалось отправить заявку. Повторите попытку.';
      if (document.documentElement.dataset.staticHost === 'true') {
        const whatsapp = document.querySelector('a[href^="https://wa.me/"], a[href^="https://api.whatsapp.com/"]');
        if (whatsapp) {
          const link = document.createElement('a');
          link.href = whatsapp.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = kazakhPage ? ' WhatsApp ашу' : ' Открыть WhatsApp';
          link.style.cssText = 'text-decoration:underline;color:inherit';
          box.appendChild(link);
        }
      }
    } finally {
      formPending.delete(form);
      if (button) { button.disabled = false; button.classList.remove('t-btn_sending'); }
    }
  }

  // Capture click as well as Enter, because Tilda normally submits from its button handler.
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[type="submit"]');
    const form = button?.closest('form');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submit(form);
  }, true);
  document.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submit(event.target);
  }, true);

  function catalog() {
    if (/^\/privacy(?:kz)?(?:\.html)?$/.test(pagePath)) return;
    const styles = document.createElement('style');
    styles.textContent = `
      .avenue-catalog-button{position:fixed;right:30px;bottom:30px;z-index:99999999;width:110px;height:110px;display:flex;flex-direction:column;justify-content:center;align-items:center;box-sizing:border-box;padding:16px;border:0;border-radius:50%;background:#61898c;color:#fff;font:13px/1.2 -apple-system,BlinkMacSystemFont,system-ui,Roboto,"Segoe UI","Helvetica Neue",sans-serif;text-align:center;cursor:pointer}
      .avenue-catalog-button::before,.avenue-catalog-button::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:50%;background:#6d788a}
      .avenue-catalog-button::before{opacity:.4;animation:avenue-catalog-pulse 3.5s ease-in-out infinite}
      .avenue-catalog-button::after{opacity:.2;transform:scale(1.1)}
      .avenue-catalog-button img{width:32px;height:32px;display:block}
      .avenue-catalog-button:focus-visible{outline:2px solid #2f363c;outline-offset:7px}
      @keyframes avenue-catalog-pulse{0%,15%,50%,86%,100%{transform:scale(1)}35%,65%{transform:scale(1.1)}}
      .avenue-catalog-dialog{position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#fff;z-index:100000000}
      .avenue-catalog-dialog::backdrop{background:#fff}
      .avenue-catalog-dialog iframe{display:block;width:100%;height:100%;border:0}
      .avenue-catalog-close{position:absolute;right:16px;top:12px;width:40px;height:40px;z-index:2;border:0;border-radius:50%;background:white;color:#333;font:30px/1 Arial;cursor:pointer;box-shadow:0 1px 8px #0002}
      @media(prefers-reduced-motion:reduce){.avenue-catalog-button::before{animation:none}}
    `;
    document.head.appendChild(styles);
    const button = document.createElement('button');
    button.className = 'avenue-catalog-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Помещения в наличии');
    button.innerHTML = `<img src="${localPath('assets/catalog/buildings.svg')}" alt=""><span>Помещения<br>в наличии</span>`;
    document.body.appendChild(button);
    const dialog = document.createElement('dialog');
    dialog.className = 'avenue-catalog-dialog';
    dialog.setAttribute('aria-label', 'Каталог помещений');
    const close = document.createElement('button');
    close.className = 'avenue-catalog-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Закрыть каталог');
    close.textContent = '×';
    close.addEventListener('click', () => dialog.close());
    dialog.appendChild(close);
    document.body.appendChild(dialog);
    button.addEventListener('click', () => {
      if (!dialog.querySelector('iframe')) {
        const frame = document.createElement('iframe');
        frame.title = 'Каталог помещений SAF';
        frame.src = 'https://smart-catalog.profitbase.ru/eco/catalog/projects/houses?accountId=4678&referrer=https%3A%2F%2Fsaf.sensata.kz&filter=property.status%3AAVAILABLE&pbApiKey=7aae743a84cb21c4405b5e2092523acf';
        dialog.appendChild(frame);
      }
      dialog.showModal();
    });
  }

  function backToTop() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avenue-back-to-top';
    button.setAttribute('aria-label', 'Наверх');
    button.title = 'Наверх';
    button.hidden = true;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
    document.body.appendChild(button);
    let framePending = false;
    function update() {
      framePending = false;
      button.hidden = window.scrollY < Math.max(480, window.innerHeight * 0.5);
    }
    function scheduleUpdate() {
      if (framePending) return;
      framePending = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    update();
  }
  document.addEventListener('DOMContentLoaded', () => {
    revealAnimations();
    materialCards();
    catalog();
    backToTop();
  });
})();
