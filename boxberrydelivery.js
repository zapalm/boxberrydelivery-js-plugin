/**
 * BoxberryDelivery: модуль для PrestaShop 1.5-8
 *
 * @author    Maksim T. <zapalm@yandex.com>
 * @copyright 2015-2024 Maksim T.
 * @license   https://prestashop.modulez.ru/ru/content/3-terms-and-conditions-of-use#closed-source-license Проприетарная лицензия на ПО с закрытым исходным кодом
 * @link      https://prestashop.modulez.ru/ru/developer/zapalm Модули автора
 */

/**
 * JS-плагин для интеграции функций модуля BoxberryDelivery на страницу чекаута PrestaShop.
 *
 * Известные проблемы, которые не нужно решать в рамках модуля:
 * 1. В PS 1.5 при F5 иногда изменяется выбранный перевозчик, хотя, если без него обновить страницу, то проблемы не будет.
 *
 * @link   https://github.com/zapalm/boxberrydelivery-js-plugin Репозиторий этого JS-плагина с документацией для совместных доработок.
 * @author Maksim T. <zapalm@yandex.com>
 */
(function ($) {
    /**
     * Конструктор.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    function BoxberryDelivery(carrierId, isExpressDelivery) {

        /** @param string Идентификатор перевозчика */
        this.carrierId = parseInt(carrierId);

        /** @param bool Инициализирован ли объект */
        this.initialized = false;

        /** @param bool Является ли перевозчик курьерской доставкой */
        this.isExpressDelivery = isExpressDelivery;

        /** @param bool Выбран ли адрес ПВЗ */
        this.isAddressSelected = false;

        /** @param string ID блока, в котором размещается ссылка для выбора ПВЗ */
        this.widgetLinkId = '';

        /** @param string Ссылка с приглашением выбрать ПВЗ или адресом уже выбранного ПВЗ */
        this.widgetLinkHtml = '';
        
        /** @param string Текст приглашения по выбору ПВЗ */
        this.widgetLinkContent = 'Выбрать пункт выдачи заказа (ПВЗ)';

        /** @param string ID ссылки для выбора ПВЗ */
        this.widgetAnchorId = 'boxberry-widget-open-' + carrierId;

        /** @param bool Модуль "One Page Checkout PrestaShop от PresTeamShop" (2.0.7, 2.2.4, 2.6.8) */
        this.modulePresTeamShop = false;

        /** @param bool Модуль "SuperCheckout от Knowband" (4.0.7) */
        this.moduleSuperCheckout = false;

        /** @param bool Стандартный чекаут PS 1.5 */
        this.PS15 = false;

        /** @param bool Стандартный чекаут PS 1.6 */
        this.PS16 = false;

        /** @param bool Стандартный чекаут PS 1.7 */
        this.PS17 = false;

        /** @param bool Стандартный чекаут PS 8 */
        this.PS8 = false;

        /** @param string Сообщение, что ПВЗ не выбран */
        this.alertPickpointNotSelected = 'Вы не выбрали пункт выдачи товара.';
        
        /** @param string Сообщение о невозможности доставки до ПВЗ */
        this.alertPickpointDeliveryNotAllowed = 'Доставка до ПВЗ невозможна.';

        /** @param string Сообщение о невозможности доставки курьером */
        this.alertExpressDeliveryNotAllowed = 'Курьерская доставка невозможна.';

        /** @param string Сообщение, что система чекаута не поддерживается (отличается набор функций) */
        this.alertCheckoutNotSupported = 'Данная версия системы чекаута не поддерживается.';

        /**
         * @param bool
         *
         * Настройка - является ли чекаут модифицированным. Настройка нужна, чтобы включить альтернативный способ модификации
         * DOM и, чтобы достаточно было, для большинства случаев, указать true в переопределённом файле; для других случаев
         * потребуется доработка.
         */
        this.isModifiedCheckout = false;

        /**
         * @param bool
         *
         * Настройка - включить/отключить функцию по запрету отправки формы, если не указан ПВЗ или выбрана курьерская доставка,
         * которая невозможна. По-умолчанию решено было отключить (сразу для всех чекаутов) из-за неочевидного поведения в
         * PS 8 (после проверки и указания корректных данных о ПВЗ уже нельзя было отправить форму из-за специфики темы PS 8,
         * т.к. в ней тоже реализовано отключение кнопки при нажатии на способы доставки и переходе между шагами, так вот,
         * после её обработки уже нельзя отправить форму). Для включения функции - указать true в переопределённом файле.
         */
        this.enableDataCheckBeforeSubmit = false;
    }

    /**
     * Инициализировать.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.init = function () {
        var self   = this;
        var $radio = self.getRadioSelector();

        if (0 === $radio.length) {
            self.log('Селектор не найден.');

            return;
        }

        if (true === self.initialized) {
            self.log('Попытка повторной инициализации.');

            return;
        }

        $(document).on('change', self.getRadioSelector(), function () {
            if (self.carrierId === self.getRadioSelectorCarrierId()) {
                if (false === self.isExpressDelivery) {
                    self.toggleWidgetLink();
                }

                if (self.isRadioSelectorChecked()) {
                    self.saveDeliveryMethod();
                } else {
                    if (false === self.isExpressDelivery) {
                        // -- Переинициализируем ПВЗ с паузой, чтобы новый способ доставки успел сохраниться
                        setTimeout(function() {
                            self.getAddress();
                        }, 1000);
                        // -- -- --
                    }
                }
            }
        });

        if (false === self.isExpressDelivery) {
            $(document).on('click', '#' + self.widgetAnchorId, function(event) {
                event.preventDefault();

                boxberry.versionAPI(BOXBERRYDELIVERY_API_URL);
                boxberry.sucrh(BOXBERRYDELIVERY_CARRIERS_SURCHARGES);
                boxberry.open(
                    function(data) {
                        self.callbackHandler(data, self);
                    },
                    BOXBERRYDELIVERY_API_KEY,
                    BOXBERRYDELIVERY_CITY,
                    '', // Код пункта приема посылок (на текущий момент не используется).
                    BOXBERRYDELIVERY_ORDER_TOTAL,
                    BOXBERRYDELIVERY_CASE_WEIGHT,
                    BOXBERRYDELIVERY_PAY_ON_DELIVERY_AMOUNT[self.carrierId],
                    BOXBERRYDELIVERY_CASE_HEIGHT,
                    BOXBERRYDELIVERY_CASE_WIDTH,
                    BOXBERRYDELIVERY_CASE_DEPTH
                );
            });
        }

        // -- Определение типа чекаута
        if ('1' === BOXBERRYDELIVERY_MODIFIED_CHECKOUT) {
            self.isModifiedCheckout = true;
        }

        if ('1' === BOXBERRYDELIVERY_MODULE_SUPERCHECKOUT) {
            self.moduleSuperCheckout = true;
            self.log('Система чекаута: модуль SuperCheckout.');
        } else if (typeof(AppOPC) !== 'undefined') {
            self.modulePresTeamShop = true;
            self.log('Система чекаута: модуль PresTeamShop.');
        } else if (8 === parseInt(BOXBERRYDELIVERY_PS_VERSION)) {
            self.PS8 = true;
            self.log('Система чекаута: PS 8. Тема: ' + (self.isModifiedCheckout ? 'необычная' : 'обычная') + '.');

            if (0 === $radio.closest('.delivery-option').length) {
                self.log('Не найден блок ".delivery-option". Система чекаута модифицирована (корректная работа модуля невозможна).', 'warning');
            }
        } else if ('1.7' === BOXBERRYDELIVERY_PS_VERSION) {
            self.PS17 = true;
            self.log('Система чекаута: PS 1.7. Тема: ' + (self.isModifiedCheckout ? 'необычная' : 'обычная') + '.');

            if (0 === $radio.closest('.delivery-option').length) {
                self.log('Не найден блок ".delivery-option". Система чекаута модифицирована (корректная работа модуля невозможна).', 'warning');
            }
        } else if ('1.6' === BOXBERRYDELIVERY_PS_VERSION) {
            self.PS16 = true;
            self.log('Система чекаута: PS 1.6.');

            if (null === $radio.closest('tr').html()) {
                self.log('Не найден блок "<TR>". Система чекаута модифицирована (корректная работа модуля невозможна).', 'warning');
            }
        } else if ('1.5' === BOXBERRYDELIVERY_PS_VERSION) {
            self.PS15 = true;
            self.log('Система чекаута: PS 1.5.');

            if (0 === $('label[for="' + $radio.prop('id') + '"]').find('table.resume').length) {
                self.log('Не найден блок ".resume". Система чекаута модифицирована (корректная работа модуля невозможна).', 'warning');
            }
        } else {
            self.log('Неизвестная система чекаута (корректная работа модуля невозможна).', 'warning');
        }
        // -- -- --

        if (false === self.isExpressDelivery) {
            // -- Формируем ссылку для выбора пункта выдачи
            self.widgetLinkId = 'boxberry-pickpoint-widget-link-' + self.carrierId;

            if (self.moduleSuperCheckout) {
                self.widgetLinkHtml = '<tr class="boxberry-pickpoint-widget-link"><td id="' + self.widgetLinkId + '" colspan="3" style="width: auto;">' + self.getWidgetLink(self.widgetLinkContent) + '</td></tr>';
            } else if (self.modulePresTeamShop || self.PS17 || self.PS8) {
                if (self.isModifiedCheckout) {
                    self.widgetLinkHtml = '<div class="boxberry-pickpoint-widget-link" id="' + self.widgetLinkId + '">' + self.getWidgetLink(self.widgetLinkContent) + '</div>';
                } else {
                    self.widgetLinkHtml = '<div class="boxberry-pickpoint-widget-link col-sm-12" id="' + self.widgetLinkId + '">' + self.getWidgetLink(self.widgetLinkContent) + '</div>';
                }
            } else {
                self.widgetLinkHtml = '<tr class="boxberry-pickpoint-widget-link"><td id="' + self.widgetLinkId + '" colspan="4">' + self.getWidgetLink(self.widgetLinkContent) + '</td></tr>';
            }
            // -- -- --
        }

        self.initialized = true;
        self.log('Инициализирован.');

        if (self.isExpressDelivery) {
            self.getExpressDeliveryData();
        } else {
            self.appendLink();
            self.getAddress();
        }

        if (self.isRadioSelectorChecked() && false === self.isAddressSelected) {
            self.checkRadioSelector(true);
        }

        // -- Перед отправкой формы проверяем, что выбран пункт выдачи или, что возможна курьерская доставка
        var $form = $radio.closest('form');
        if (self.enableDataCheckBeforeSubmit
            && $form.length > 0
            && (self.PS15 || self.PS16   // При многошаговом оформлении заказа для старых версий PS (при одностраничном - проверка ниже)
                || self.PS17 || self.PS8 // Проверка не отличается для новых версий PS
            )
        ) {
            $(document).on('submit', $form, function () {
                if (self.isExpressDelivery) {
                    if (false === self.isExpressDeliveryAllowed()) {
                        self.alertNotice(self.alertExpressDeliveryNotAllowed);

                        return false;
                    }
                } else {
                    if (false === self.isPickpointAddressSelected()) {
                        self.alertNotice(self.alertPickpointNotSelected);

                        return false;
                    }

                    if (false === self.isPickpointDeliveryAllowed()) {
                        self.alertNotice(self.alertPickpointDeliveryNotAllowed);

                        return false;
                    }
                }
            });
        }
        // -- -- --

        // -- Такая же проверка при одностраничном оформлении заказа (OPC) для старых версий PS
        if (self.enableDataCheckBeforeSubmit && (self.PS15 || self.PS16)) {
            $(document).on('click', '#HOOK_PAYMENT a', function () {
                if (self.isExpressDelivery) {
                    if (false === self.isExpressDeliveryAllowed()) {
                        self.alertNotice(self.alertExpressDeliveryNotAllowed);

                        return false;
                    }
                } else {
                    if (false === self.isPickpointAddressSelected()) {
                        self.alertNotice(self.alertPickpointNotSelected);

                        return false;
                    }

                    if (false === self.isPickpointDeliveryAllowed()) {
                        self.alertNotice(self.alertPickpointDeliveryNotAllowed);

                        return false;
                    }
                }
            });
        }
        // -- -- --

        // -- Такая же проверка при использовании модуля "One Page Checkout PrestaShop от PresTeamShop"
        if (self.enableDataCheckBeforeSubmit && self.modulePresTeamShop) {
            Review.placeOrder = (function () {
                var original = Review.placeOrder;

                return function (params) {
                    if (self.isExpressDelivery) {
                        if (false === self.isExpressDeliveryAllowed()) {
                            self.alertNotice(self.alertExpressDeliveryNotAllowed);

                            return;
                        }
                    } else {
                        if (false === self.isPickpointAddressSelected()) {
                            self.alertNotice(self.alertPickpointNotSelected);

                            return;
                        }

                        if (false === self.isPickpointDeliveryAllowed()) {
                            self.alertNotice(self.alertPickpointDeliveryNotAllowed);

                            return;
                        }
                    }

                    original(params);
                };
            })();
        }
        // -- -- --

        // -- Такая же проверка при использовании модуля "SuperCheckout от Knowband"
        if (self.enableDataCheckBeforeSubmit && self.moduleSuperCheckout) {
            window.placeOrder = (function () {
                var original = window.placeOrder;

                return function () {
                    if (self.isExpressDelivery) {
                        if (false === self.isExpressDeliveryAllowed()) {
                            self.alertNotice(self.alertExpressDeliveryNotAllowed);

                            return;
                        }
                    } else {
                        if (false === self.isPickpointAddressSelected()) {
                            self.alertNotice(self.alertPickpointNotSelected);

                            return;
                        }

                        if (false === self.isPickpointDeliveryAllowed()) {
                            self.alertNotice(self.alertPickpointDeliveryNotAllowed);

                            return;
                        }
                    }

                    original();
                };
            })();
        }
        // -- -- --
    };

    /**
     * Получить элемент выбора текущего перевозчика.
     *
     * Всегда возвращает элемент перевозчика, который относится только к этому модулю.
     *
     * @returns {jQuery}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getRadioSelector = function () {
        var radioSelector = this.carrierId + ','; // Идентификатор элемента выбора для способа доставки (запятая в конце добавляется из-за бага PS, который остается от версии к версии)
        var radioId = $('input[value="' + radioSelector + '"]').attr('id');

        return $('#' + radioId);
    };

    /**
     * Получить идентификатор перевозчика по кнопке выбора текущего перевозчика.
     *
     * @todo Разобраться, т.к. self.carrierId должен иметь тоже самое значение, тогда, зачем я метод написал?
     *       Проверить в разных версиях и чекаутах. В 1.6 не вижу разницы.
     *
     * @returns {Number}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getRadioSelectorCarrierId = function () {
        return parseInt(this.getRadioSelector().prop('value'));
    };

    /**
     * Установить в положение "выбрано" текущего перевозчика.
     *
     * Этот метод для того случая, когда перевозчик не выбран и нужно сделать этот выбор.
     * Также выбор может слетать при динамическом обновлении блоков страницы.
     * Также нужен, чтобы работала проверка, что выбран ПВЗ при переходе на следующий шаг.
     * Для случая, когда адрес ПВЗ есть, а выбор перевозчика не сделан - пока не использую этот метод, т.к. возникает проблема зацикливания.
     *
     * @param {Boolean} triggerAction Запустить действие по изменению выбора перевозчика.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.checkRadioSelector = function (triggerAction) {
        this.isAddressSelected = true;

        if (true === triggerAction) {
            var $radio = this.getRadioSelector();
            // Устанавливать атрибут и получать его нужно всегда через prop(), а не через attr(), т.к. только он вернёт
            // достоверное значение. Например, может быть установлен атрибут checked, но при этом быть не "выбранным",
            // потому что атрибут checked показывает лишь начальное значение.
            if (false === $radio.prop('checked')) {
                $radio.prop('checked', true);
            } else {
                if ($radio.is(':visible')) {
                    // Бросаем событие только, если выбор перевозчика - видимый, т.е. пользователь находится на странице
                    // (вкладке) по выбору перевозчика, иначе это приведёт к цикличной перезагрузке страницы в PS 1.7.
                    $radio.change();
                }
            }
        }
    };

    /**
     * Получить токен безопасности для URL.
     *
     * @returns {String|Boolean}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getStaticToken = function () {
        if (typeof(static_token) !== 'undefined') {
            return static_token;
        }

        if (typeof(prestashop) !== 'undefined') {
            return prestashop.static_token;
        }

        return false;
    };

    /**
     * Вставить ссылку с приглашением выбора ПВЗ.
     *
     * @see init() Перед вызовом должен быть сначала вызван метод init() для инициализации объекта.
     *
     * @param {Boolean} reinit Указать true, чтобы стереть существующий адрес из ссылки и добавить приглашение.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.appendLink = function (reinit) {
        var $widgetLinkId         = null;
        var $widgetLinkClassOwner = null;

        if (false === this.initialized) {
            return;
        }

        if (this.isExpressDelivery) {
            this.log('Некорректный запуск метода appendLink().');

            return;
        }

        if (true !== reinit && null !== document.getElementById(this.widgetLinkId)) {
            return;
        } else if (true === reinit) {
            // -- Удаляем блок со ссылкой по признаку наличия класса
            $widgetLinkId         = $(document).find('#' + this.widgetLinkId);
            $widgetLinkClassOwner = $widgetLinkId;

            if (false === $widgetLinkId.hasClass('boxberry-pickpoint-widget-link')) {
                $widgetLinkClassOwner = $widgetLinkId.parent(); // Класс присвоен родительскому блоку
            }

            $widgetLinkClassOwner.remove();
            // -- -- --
        }

        var $radio = this.getRadioSelector();
        if (this.modulePresTeamShop) {
            $radio.closest('.delivery_option').append(this.widgetLinkHtml);
        } else if (this.PS17 || this.PS8) {
            if (this.isModifiedCheckout) {
                $radio.closest('.delivery-option')
                    .find('.row div:first')
                    .append(this.widgetLinkHtml)
                ;
            } else {
                $radio.closest('.delivery-option').append(this.widgetLinkHtml);
            }
        } else if (this.PS16 || this.moduleSuperCheckout) {
            $radio.closest('tr').after(this.widgetLinkHtml);
        } else if (this.PS15) {
            $('label[for="' + $radio.prop('id') + '"]').find('table.resume').append(this.widgetLinkHtml);
        }

        this.toggleWidgetLink();
    };

    /**
     * Переключить видимость ссылки (отображаем ссылку для выбора ПВЗ только, если выбран перевозчик).
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.toggleWidgetLink = function () {
        if (this.isExpressDelivery) {
            this.log('Некорректный запуск метода toggleWidgetLink().');

            return;
        }

        var $widgetLinkId         = $(document).find('#' + this.widgetLinkId);
        var $widgetLinkClassOwner = $widgetLinkId;

        if (false === $widgetLinkId.hasClass('boxberry-pickpoint-widget-link')) {
            $widgetLinkClassOwner = $widgetLinkId.parent(); // Класс присвоен родительскому блоку
        }

        if (this.isRadioSelectorChecked()) {
            $widgetLinkClassOwner.show();

            // Добавляем мигание только для ссылки по приглашению выбрать ПВЗ
            if (false === this.isAddressSelected) {
                $widgetLinkId.fadeOut(1000).fadeIn(1000);
            }
        } else {
            $widgetLinkClassOwner.hide();
        }
    };

    /**
     * Добавить информацию о доставке (стоимость, время).
     *
     * @param {Object} jsonData Данные, полученные с сайта.
     *
     * @see getAddress()
     * @see getExpressDeliveryData()
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.appendDeliveryInfo = function (jsonData) {
        var $radio        = this.getRadioSelector();
        var $parent       = null;
        var $priceBlock   = null;
        var $infoBlock    = null;
        var $carrierDelay = null;

        // Устанавливаем флаг, доступен ли перевозчик, который означает, можно ли переходить на следующий шаг
        $radio.attr('data-boxberry-allowed', jsonData.data[3]);

        if (this.PS15 || this.modulePresTeamShop) {
            $parent = $radio.closest('.delivery_option');
            if (1 === $parent.length) {
                // -- Обновляем цену
                $priceBlock = $parent.find('.delivery_option_price');
                if (1 === $priceBlock.length) {
                    $priceBlock.html(jsonData.data[1]);
                }
                // -- -- --

                // -- Обновляем время доставки
                $carrierDelay = $parent.find('.delivery_option_delay');
                if (1 === $carrierDelay.length) {
                    $carrierDelay.html(jsonData.data[2]);
                }
                // -- -- --
            }
        } else if (this.PS16) {
            $parent = $radio.closest('tr');
            if (1 === $parent.length) {
                // -- Обновляем цену
                $priceBlock = $parent.find('.delivery_option_price:last'); // Модификатор last, т.к. используется класс дважды
                if (1 === $priceBlock.length) {
                    $priceBlock.html(jsonData.data[1]);
                }
                // -- -- --

                // -- Обновляем время доставки
                $infoBlock = $parent.find('td:eq(2)');
                if (1 === $infoBlock.length) {
                    var carrierLabel = $infoBlock.find('strong').html(); // Наименование перевозчика
                    $infoBlock.html('<strong>' + carrierLabel + '</strong><br>' + jsonData.data[2]);
                }
                // -- -- --
            }
        } else if (this.PS17 || this.PS8) {
            $parent = $radio.closest('.delivery-option');
            if (1 === $parent.length) {
                // -- Обновляем цену
                $priceBlock = $parent.find('.carrier-price');
                if (1 === $priceBlock.length) {
                    $priceBlock.html(jsonData.data[1]);
                }
                // -- -- --

                // -- Обновляем время доставки
                $carrierDelay = $parent.find('.carrier-delay');
                if (1 === $carrierDelay.length) {
                    $carrierDelay.html(jsonData.data[2]);
                }
                // -- -- --
            }
        } else if (this.moduleSuperCheckout) {
            $parent = $radio.closest('tr');
            if (1 === $parent.length) {
                // -- Обновляем цену
                $priceBlock = $parent.find('td:last');
                if (1 === $priceBlock.length) {
                    $priceBlock.html(jsonData.data[1]);
                }
                // -- -- --

                // -- Обновляем время доставки
                $carrierDelay = $parent.find('td:eq(1) span');
                if (1 === $carrierDelay.length) {
                    $carrierDelay.html(jsonData.data[2]);
                }
                // -- -- --
            }
        }
    };

    /**
     * Получить ранее выбранный адрес (с БД сайта).
     * Перед вызовом должен быть сначала вызван метод appendLink(), чтобы появилась ссылка.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getAddress = function () {
        var self       = this;
        var widgetLink = document.getElementById(self.widgetLinkId);

        if (null === widgetLink) {
            return;
        }

        $.ajax({
            headers: {'cache-control': 'no-cache'},
            url: BOXBERRYDELIVERY_CONTROLLER.replace(/&amp;/g, '&'), // Т.к. PS 1.7 экранирует Url по-умолчанию так, что для запроса они становятся нерабочими
            async: true,
            cache: false,
            dataType: 'json',
            data: 'action=getPickpointData&carrierId=' + self.carrierId + '&token=' + self.getStaticToken(),
            success: function (jsonData) {
                // Обновляем данные на странице. Коснутся данные только выбранного способа доставки. Поэтому, при несколько
                // шаговом чекауте не будут обновляться данные не выбранных способов доставки (не стал реализовывать).
                if (false !== jsonData.result) {
                    // Обновляем текст с выбранным адресом
                    $(widgetLink).html('<b>Вы выбрали:</b> ' + self.getWidgetLink(jsonData.data[0]));

                    self.checkRadioSelector();
                } else {
                    // -- Возвращаем данные к исходному состоянию
                    self.appendLink(true);
                    self.isAddressSelected = false;
                    // -- -- --
                }

                // Обновляем остальные данные
                self.appendDeliveryInfo(jsonData);
            },
            error: function (XMLHttpRequest, textStatus) {
                if (textStatus !== 'abort') {
                    self.log('Ошибка AJAX-запроса: ' + textStatus);
                }
            }
        });
    };

    /**
     * Получить данные по курьерской доставке.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getExpressDeliveryData = function () {
        var self = this;

        $.ajax({
            headers: {'cache-control': 'no-cache'},
            url: BOXBERRYDELIVERY_CONTROLLER.replace(/&amp;/g, '&'), // Т.к. PS 1.7 экранирует Url по-умолчанию так, что для запроса они становятся нерабочими
            async: true,
            cache: false,
            dataType: 'json',
            data: 'action=getExpressDeliveryData&carrierId=' + self.carrierId + '&token=' + self.getStaticToken(),
            success: function (jsonData) {
                // Обновляем данные на странице. Коснутся данные только выбранного способа доставки. Поэтому, при многошаговом
                // чекауте не будут обновляться данные способов доставки, которые не выбраны (реализовывать не стал).
                self.appendDeliveryInfo(jsonData);
            },
            error: function (XMLHttpRequest, textStatus) {
                if (textStatus !== 'abort') {
                    self.log('Ошибка AJAX-запроса: ' + textStatus);
                }
            }
        });
    };

    /**
     * Переключить состояние кнопки формы.
     *
     * @param {Boolean} toggleOff Указать true, чтобы заблокировать кнопку, иначе - false.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.toggleSubmitButton = function (toggleOff) {
        var self         = this;
        var $button      = null;
        var $buttonBlock = null;

        // В 1.5 и 1.6 одностраничный чекаут отправляет форму по нажатии на ссылку способа оплаты
        var $paymentBlock = $('#HOOK_PAYMENT');
        if (1 === $paymentBlock.length && $paymentBlock.find('a').length > 0) {
            $buttonBlock = $paymentBlock;
        }

        if (self.PS16 || self.PS17 || self.PS8) {
            $button = self.getRadioSelector().closest('form').find('button[type=submit]');
        } else if(self.modulePresTeamShop) {
            $button = $('#btn_place_order');
        } else if (self.moduleSuperCheckout) {
            $buttonBlock = $('#supercheckout_confirm_order');
        }

        if (null !== $button && 1 === $button.length) {
            if (true === toggleOff) {
                $button.attr('disabled', 'disabled');
                $button.addClass('disabled'); // Нужно для поддержки некоторых тем, чтобы работала стилизация отключённой кнопки
            } else {
                $button.removeAttr('disabled');
                $button.removeClass('disabled');
            }
        }

        if (null !== $buttonBlock && 1 === $buttonBlock.length) {
            if (true === toggleOff) {
                $buttonBlock.hide();
            } else {
                $buttonBlock.show();
            }
        }
    };

    /**
     * Сохранить выбранный способ доставки.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.saveDeliveryMethod = function () {
        var self = this;

        $.ajax({
            headers: {'cache-control': 'no-cache'},
            url: BOXBERRYDELIVERY_CONTROLLER.replace(/&amp;/g, '&'), // Т.к. PS 1.7 экранирует Url по-умолчанию так, что для запроса они становятся нерабочими
            async: true,
            cache: false,
            dataType: 'json',
            data: 'action=saveDeliveryMethod&carrierId=' + self.carrierId + '&token=' + self.getStaticToken(),
            beforeSend: function () {
                self.toggleSubmitButton(true);
            },
            success: function (jsonData) {
                // Обработка не нужна.
            },
            error: function (XMLHttpRequest, textStatus) {
                if (textStatus !== 'abort') {
                    self.log('Ошибка AJAX-запроса: ' + textStatus);
                }
            },
            complete: function () {
                self.toggleSubmitButton(false);
            }
        });
    };

    /**
     * Обработчик обратного вызова виджета (запускает, когда пользователь выбрал ПВЗ).
     *
     * @param {Object}           data   Данные о выбранном ПВЗ.
     * @param {BoxberryDelivery} object Объект BoxberryDelivery.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.callbackHandler = function (data, object) {
        var self = object;

        $.ajax({
            type: 'POST',
            headers: {'cache-control': 'no-cache'},
            url: BOXBERRYDELIVERY_CONTROLLER.replace(/&amp;/g, '&'), // Т.к. PS 1.7 экранирует Url по-умолчанию так, что для запроса они становятся нерабочими
            async: true,
            cache: false,
            dataType: 'json',
            data: 'action=savePickpointData&carrierId=' + self.carrierId + '&data=' + JSON.stringify(data) + '&token=' + self.getStaticToken(),
            success: function (jsonData) {
                if (true === jsonData.result) {
                    // -- Обновляем текст с выбранным адресом
                    var widgetLink = document.getElementById(self.widgetLinkId);
                    $(widgetLink).html('<b>Вы выбрали:</b> ' + self.getWidgetLink(jsonData.data[0]));
                    // -- -- --

                    // Обновляем остальные данные
                    self.appendDeliveryInfo(jsonData);
                    self.checkRadioSelector();
                } else {
                    // -- Возвращаем данные к исходному состоянию
                    self.appendLink(true);
                    self.appendDeliveryInfo(jsonData);
                    self.isAddressSelected = false;
                    // -- -- --
                }

                // Обновляем цену доставки в блоке с суммарной информацией.
                // Нужно только для профилей ПВЗ, потому что для курьерских профилей обновляется автоматически при выборе.
                // Исключение: многошаговый чекаут, т.к. при нём не происходит обновление данных при изменении способа
                // доставки. Эта недоработка PS, поэтому я не стал ёё решать в рамках модуля, но если в будущем нужно
                // будет решить эту проблему, то лучше это сделать модификацией функции updateExtraCarrier(), добавив в
                // неё параметр для функции обратного вызова - self.updateCartSummary().
                // Вызывать лучше функцию конкретно по обновлению блока, чтобы сократить время обработки.
                if (self.carrierId === self.getRadioSelectorCarrierId() && self.isRadioSelectorChecked()) {
                    self.updateCartSummary();
                }
            },
            error: function (XMLHttpRequest, textStatus) {
                if (textStatus !== 'abort') {
                    self.log('Ошибка AJAX-запроса: ' + textStatus);
                }
            }
        });

        return false;
    };

    /**
     * Получить HTML-код ссылки для открытия модального окна виджета.
     *
     * @param {string} linkText Текст ссылки.
     *
     * @returns {string}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.getWidgetLink = function (linkText) {
        return '<a href="#" id="' + this.widgetAnchorId + '">' + linkText + '</a>';
    };

    /**
     * Обновить цену доставки в блоке с суммарной информацией.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.updateCartSummary = function () {
        var self = this;

        if (self.moduleSuperCheckout) {
            if (updateCarrierOnDeliveryChange === 'function') {
                updateCarrierOnDeliveryChange();
            } else {
                self.log(self.alertCheckoutNotSupported);
            }
        } else if (self.modulePresTeamShop) {
            if (typeof(Review) !== 'undefined' && typeof Review.display === 'function') {
                Review.display();
            } else {
                self.log(self.alertCheckoutNotSupported);
            }
        } else if (self.PS17 || self.PS8) {
            // В 1.7 из-за сложной системы запуска обновления блока, никак не сделать, кроме запуска события
            // по изменению способа доставки. Раньше было выявлено, что выбор способа доставки при выборе ПВЗ
            // могло вызывать проблемы (кажется, было зацикливание), поэтому в данном случае нужно убедиться, что выбор
            // текущего способа доставки уже сделан, чтобы запуск события выбора способа доставки был корректен.
            self.checkRadioSelector(true);
        } else if (self.PS16 || self.PS15) {
            // Оказалось наиболее лучшим решением - собственная обработка. Потому что функция updateAddressSelection()
            // работает только для OPC. Можно еще хитростью запустить функцию updateCartSummary() вот таким образом:
            // deleteProductFromSummary('0_0')
            $.ajax({
                type: 'POST',
                headers: {'cache-control': 'no-cache'},
                url: baseUri,
                async: true,
                cache: false,
                dataType: 'json',
                data: 'controller=cart&ajax=1&summary=1&token=' + self.getStaticToken(),
                success: function (jsonData) {
                    updateCartSummary(jsonData.summary);
                },
                error: function (XMLHttpRequest, textStatus) {
                    if (textStatus !== 'abort') {
                        self.log('Ошибка AJAX-запроса: ' + textStatus);
                    }
                }
            });
        }
    };

    /**
     * Проверить, что выбран адрес ПВЗ.
     *
     * @returns {boolean}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.isPickpointAddressSelected = function () {
        if (this.isRadioSelectorChecked() && false === this.isAddressSelected) {
            // Запрещаем отправку формы
            return false;
        }

        // Разрешаем отправку формы
        return true;
    };

    /**
     * Проверить, что доставка до ПВЗ возможна.
     *
     * @returns {boolean}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.isPickpointDeliveryAllowed = function () {
        // По какой-то причине, если использовать data(), то не будет возвращать true в некоторых случаях, поэтому сделано через attr()
        if (this.isRadioSelectorChecked() && 'true' !== this.getRadioSelector().attr('data-boxberry-allowed')) {
            // Запрещаем отправку формы
            return false;
        }

        // Разрешаем отправку формы
        return true;
    };

    /**
     * Проверить, что курьерская доставка доступна по адресу покупателя.
     *
     * @returns {boolean}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.isExpressDeliveryAllowed = function () {
        // По какой-то причине, если использовать data(), то не будет возвращать true в некоторых случаях, поэтому сделано через attr()
        if (this.isRadioSelectorChecked() && 'true' !== this.getRadioSelector().attr('data-boxberry-allowed')) {
            // Запрещаем отправку формы
            return false;
        }

        // Разрешаем отправку формы
        return true;
    };

    /**
     * Проверить, что выбран чекбокс профиля.
     *
     * @returns {boolean}
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.isRadioSelectorChecked = function () {
        var $radio = this.getRadioSelector();

        return ($radio.prop('checked') || ('checked' === $radio.closest('span').prop('class')));
    };

    /**
     * Вывести окно с сообщением.
     *
     * @param message Сообщение.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.alertNotice = function (message) {
        if (this.moduleSuperCheckout) {
            displayGeneralError(message);
            $('html, body').animate({scrollTop: 0}, 'fast');
            var timerId = setInterval(function() {
                hideGeneralError();
                clearInterval(timerId);
            }, 3000);
        } else if (this.modulePresTeamShop) {
            // Выставляем признак ошибки
            if ('is_valid_opc' in AppOPC) {
                // С 2.3.9 или раньше (не известно точно)
                AppOPC.is_valid_opc = false;
            } else if ('is_valid_all_form' in AppOPC) {
                // Более старые версии (например, 2.0.4)
                AppOPC.is_valid_all_form = false;
            } else {
                this.log('Не найдено свойство в классе AppOPC (требуется обновление интеграции с этим модулем).', 'warning');
            }

            // А, затем, отображаем сообщение
            Fronted.showModal({type: 'warning', message: message});
        } else if (!!$.prototype.fancybox) {
            var options = {
                type: 'inline',
                autoScale: true,
                minHeight: 30,
                content: '<p class="fancybox-error">' + message + '</p>'
            };
            $.fancybox.open([options], {padding: 0});
        } else {
            alert(message);
        }
    };

    /**
     * Запустить.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.run = function() {
        var self = this;

        self.init();

        // -- Для динамически подгружаемых блоков чекаута нужно дожидаться, когда в DOM попадет способ доставки
        var $radio = self.getRadioSelector();
        var timerId = setInterval(function() {
            if (0 !== $radio.length) {
                clearInterval(timerId);
                self.init();
            } else {
                $radio = self.getRadioSelector();
            }
        }, 1000);

        setTimeout(function() {
            clearInterval(timerId);
            if (0 === $radio.length) {
                self.log('Не инициализирован (не нужно или не определен тип чекаута).');
            }
        }, 10000);
        // -- -- --

        /**
         * Переопределяем функцию updateCarrierList(), т.к. при OPC при выборе одного из способов доставки,
         * список с ними загружается вновь, а нам нужно вставлять ссылку для выбора адреса, которая вставляется
         * только единожды при загрузке документа. Обработка актуальна только для стандартных чекаутов PS 1.5 и 1.6.
         */
        if (self.PS15 || self.PS16) {
            window.updateCarrierList = (function () {
                var original = window.updateCarrierList;

                return function (json) {
                    original(json);
                    self.init();

                    if (self.isExpressDelivery) {
                        self.getExpressDeliveryData();
                    } else {
                        self.appendLink();
                        self.getAddress();
                    }
                };
            })();
        }

        /**
         * Переопределяем метод модуля "One Page Checkout PrestaShop от PresTeamShop".
         *
         * Здесь нельзя использовать свойство modulePresTeamShop для проверки, используется ли модуль,
         * потому что это свойство инициализируется позже.
         *
         * В старых версиях модуля (ниже 2.3.8 точно) есть выброс события opc-update-carrier:completed после завершения
         * метода update(), но т.к. нужна поддержка старых версий, то сделано только через переопределение этого метода.
         *
         * @todo Можно упростить этот и подобные обработки. Нужно сделать событие и запускать его в этих обработках.
         *       В методе init() подписаться на это событие и делать необходимые действия по обновлению DOM.
         */
        if (typeof(AppOPC) !== 'undefined') {
            Carrier.update = (function () {
                var original = Carrier.update;

                return function (params) {
                    original(params);

                    setTimeout(function () {
                        self.init();
                        if (self.isExpressDelivery) {
                            self.getExpressDeliveryData();
                        } else {
                            self.appendLink();
                            self.getAddress();
                        }
                    }, 1000);
                };
            })();
        }

        /**
         * Переопределяем функцию модуля "SuperCheckout от Knowband".
         * Здесь нельзя использовать свойство moduleSuperCheckout для проверки, используется ли модуль,
         * потому что это свойство инициализируется позже.
         */
        if ('1' === BOXBERRYDELIVERY_MODULE_SUPERCHECKOUT) {
            window.loadCarriers = (function () {
                var original = window.loadCarriers;

                return function () {
                    original();

                    setTimeout(function () {
                        self.init();

                        if (self.isExpressDelivery) {
                            self.getExpressDeliveryData();
                        } else {
                            self.appendLink();
                            self.getAddress();
                        }
                    }, 1000);
                };
            })();
        }
    };

    /**
     * Залогировать сообщение в консоль.
     *
     * @param {String} message Сообщение.
     * @param {String} level   Уровень.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    BoxberryDelivery.prototype.log = function (message, level) {
        message = 'BoxberryDelivery (' + (this.isExpressDelivery ? 'Курьер' : 'ПВЗ') + ': #' + this.carrierId + ') : ' + message;

        if (undefined === level) {
             level = 'info';
        }

        if ('info' === level) {
            console.info(message);
        } else if ('warning' === level) {
            console.warn(message);
        }
    };

    /**
     * Запуск скрипта.
     *
     * @author Maksim T. <zapalm@yandex.com>
     */
    $(document).ready(function () {
        console.info('BoxberryDelivery: Модуль для PrestaShop. Автор: Maksim T. (zapalm). Домашняя страница модуля: https://prestashop.modulez.ru/ru/shipping-and-pickup/34-delivery-by-boxberry.html');

        $.each(BOXBERRYDELIVERY_WARNINGS, function(i, item) {
            console.warn('BoxberryDelivery: ' + item);
        });

        if (0 !== parseInt(BOXBERRYDELIVERY_PICKPOINT_CARRIER_ID)) {
            var boxberrydeliveryPickpoint = new BoxberryDelivery(BOXBERRYDELIVERY_PICKPOINT_CARRIER_ID, false);
            boxberrydeliveryPickpoint.run();
        }

        if (0 !== parseInt(BOXBERRYDELIVERY_PICKPOINT_COD_CARRIER_ID)) {
            var boxberrydeliveryPickpointCod = new BoxberryDelivery(BOXBERRYDELIVERY_PICKPOINT_COD_CARRIER_ID, false);
            boxberrydeliveryPickpointCod.run();
        }


        if (0 !== parseInt(BOXBERRYDELIVERY_EXPRESS_CARRIER_ID)) {
            var boxberrydeliveryExpress = new BoxberryDelivery(BOXBERRYDELIVERY_EXPRESS_CARRIER_ID, true);
            boxberrydeliveryExpress.run();
        }


        if (0 !== parseInt(BOXBERRYDELIVERY_EXPRESS_COD_CARRIER_ID)) {
            var boxberrydeliveryExpressCod = new BoxberryDelivery(BOXBERRYDELIVERY_EXPRESS_COD_CARRIER_ID, true);
            boxberrydeliveryExpressCod.run();
        }
    });
}(jQuery));